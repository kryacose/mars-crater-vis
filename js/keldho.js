const color = d3.scaleOrdinal(d3.schemeAccent);
const cc = d3.scaleSequential(d3.schemeYlGn[3]);
const globe_radius = 170;
const margins = [30, 120, 70, 90]; //top, right, bottom, left
const north_pole_coords = [0, 90];
const south_pole_coords = [0, -90];
const dataset_path = "./dataset/Mars Crater info.csv";
const max_elipse_rx = 300;
const max_elipse_ry = 200;

const lat = "LATITUDE_CIRCLE_IMAGE";
const long = "LONGITUDE_CIRCLE_IMAGE";
const depth = "DEPTH_RIMFLOOR_TOPOG";
const diam = "DIAM_CIRCLE_IMAGE";

let data, filtered_data;
let projection;
let path;
let rotation = [0, -30];
let min_depth, max_depth, min_diam, max_diam;
let auto_rotate = false;
let tooltip;
let tooltip_visible = false;

let globe_x, globe_y;
let ellipse_x, ellipse_y;

let filtered_min_depth, filtered_max_depth;

const bins = [
  [150, cc(1), "Diameter Below 150"],
  [200, cc(2), "Diameter 150 - 200"],
  [300, cc(3), "Diameter 200 - 300"],
  [400, cc(4), "Diameter 300 - 400"],
  [500, cc(5), "Diameter 400 - 500"],
];

function getColorFromBin(val) {
  for (const ii of bins) {
    if (val < ii[0]) return ii[1];
  }
  return bins[bins.length - 1][2];
}

function get_dimensions(element_id) {
  let rect = document.getElementById(element_id).getBoundingClientRect();
  return [rect.width, rect.height];
}

function calculateExtendedPoint(point, length_factor = 0.5) {
  const projected = projection(point);
  const extended = [2 * projected[0] - globe_x, 2 * projected[1] - globe_y];
  const final = [
    projected[0] + length_factor * (extended[0] - projected[0]),
    projected[1] + length_factor * (extended[1] - projected[1]),
  ];
  return final;
}

function drawNorthPole() {
  svg.selectAll(".north_pole").remove();

  if (!isCoordinateVisible(north_pole_coords)) return;
  const projected = projection(north_pole_coords);
  const extended = calculateExtendedPoint(north_pole_coords);

  svg
    .append("text")
    .attr("class", "north_pole")
    .attr("x", projected[0] - 8)
    .attr("y", projected[1] - 8)
    .text("N")
    .style("font-size", "30px")
    .on("mouseover", function (event, d) {
      tooltip_visible = true;
      tooltip.style("opacity", 1);
      tooltip
        .html("North Pole")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 0 + "px");
    })
    .on("mousemove", function (event, node) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 0 + "px");
    })
    .on("mouseout", function (event, node) {
      tooltip_visible = false;
      tooltip.style("opacity", 0);
    });
}

function drawSouthPole() {
  svg.selectAll(".south_pole").remove();

  if (!isCoordinateVisible(south_pole_coords)) return;
  const projected = projection(south_pole_coords);
  const extended = calculateExtendedPoint(south_pole_coords);

  svg
    .append("text")
    .attr("class", "south_pole")
    .attr("x", projected[0] - 8)
    .attr("y", projected[1] + 30)
    .text("S")
    .style("font-size", "30px")
    .on("mouseover", function (event, d) {
      tooltip_visible = true;
      tooltip.style("opacity", 1);
      tooltip
        .html("South Pole")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 0 + "px");
    })
    .on("mousemove", function (event, node) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 0 + "px");
    })
    .on("mouseout", function (event, node) {
      tooltip_visible = false;
      tooltip.style("opacity", 0);
    });
}

function drawDebugLines(locations) {
  svg.selectAll(".line").remove();
  for (const loc of locations) {
    const projected = projection(loc);
    const extended = calculateExtendedPoint(loc);
    if (!isCoordinateVisible(loc)) continue;

    svg
      .append("line")
      .attr("class", "line")
      .attr("class", "north_pole")
      .attr("x1", projected[0])
      .attr("y1", projected[1])
      .attr("x2", extended[0])
      .attr("y2", extended[1])
      .attr("stroke", "blue")
      .attr("stroke-width", 2);
  }
}

function drawCentralLine() {
  loc = [-rotation[0], -rotation[1]];
  const projected = projection(loc);

  svg
    .append("circle")
    .attr("class", "line")
    .attr("cx", projected[0])
    .attr("cy", projected[1])
    .attr("r", 6)
    .attr("stroke", "green")
    .attr("stroke-width", 5);
}

function calcAngularDist(coord1, coord2) {
  const long1 = (coord1[0] * Math.PI) / 180;
  const lat1 = (coord1[1] * Math.PI) / 180;

  const long2 = (-coord2[0] * Math.PI) / 180;
  const lat2 = (-coord2[1] * Math.PI) / 180;

  return Math.acos(
    Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(long2 - long1)
  );
}

function isCoordinateVisible(coord) {
  return calcAngularDist(coord, rotation) <= Math.PI / 1.9;
}

function calcLengthFactor(depth, small, large) {
  if (small == large) return 0.6;
  return 0.05 + ((depth - small) / (large - small)) * (0.6 - 0.05);
}

function normalize(value, domain, range) {
  norm_val = (value - domain[0]) / (domain[1] - domain[0]);
  norm_val = norm_val * (range[1] - range[0]) + range[0];
  return norm_val;
}

function drawLines() {
  svg.selectAll(".line").remove();
  for (const row of filtered_data) {
    const location = [row[long], row[lat]];
    if (!isCoordinateVisible(location)) continue;
    const projected = projection(location);
    const extended = calculateExtendedPoint(
      location,
      calcLengthFactor(row[depth], min_depth, max_depth)
    );
    svg
      .append("line")
      .attr("class", "line crater_line")
      .attr("id", "line_" + row["CRATER_ID"])
      .attr("x1", projected[0])
      .attr("y1", projected[1])
      .attr("x2", extended[0])
      .attr("y2", extended[1])
      .attr("stroke", () => getColorFromBin(row[diam]))
      .attr("stroke-width", 4)
      .on("mouseover", function (event, d) {
        clearHighlight();
        tooltip_visible = true;
        tooltip.style("opacity", 1);
        tooltip
          .html(
            `Crater Info:
          <br>ID: ${row["CRATER_ID"]}
          ${row["CRATER_NAME"] == null ? "" : "<br>Name: " + row["CRATER_NAME"]}
          <br>Lat: ${row[lat]}
          <br>Long: ${row[long]}
          <br>Diameter: ${row[diam]}
          <br>Depth: ${row[depth]}
          <br>Layers: ${row["NUMBER_LAYERS"]}`
          )
          .style("left", event.pageX + 30 + "px")
          .style("top", event.pageY - 50 + "px");
        document
          .getElementById("ellipse_" + row["CRATER_ID"])
          .classList.add("selected_ellipse");
      })
      .on("mousemove", function (event, node) {
        // tooltip
        //   .style("left", event.pageX + 30 + "px")
        //   .style("top", event.pageY - 50 + "px");
      })
      .on("mouseout", function (event, node) {
        tooltip_visible = false;
        tooltip.style("opacity", 0);
        document
          .getElementById("ellipse_" + row["CRATER_ID"])
          .classList.remove("selected_ellipse");
      });
  }
}

function drawLegend() {
  const size = 12;

  for (var ii in bins) {
    const bin = bins[ii];
    svg
      .append("rect")
      .attr("x", size)
      .attr("y", height - (2 * ii + 2) * size)
      .attr("width", size)
      .attr("height", size)
      .style("fill", bin[1]);

    svg
      .append("text")
      .attr("x", 2.5 * size)
      .attr("y", height - (2 * ii + 1) * size)
      .text(bin[2]);
  }
}

function drawTitles() {
  const fsize = 30;
  svg
    .append("text")
    .attr("x", globe_x - 100)
    .attr("y", 50)
    .text("Crater Locations")
    .style("font-size", `${fsize}px`);

  svg
    .append("text")
    .attr("x", ellipse_x + 170)
    .attr("y", 50)
    .text("Crater Cross Sections")
    .style("font-size", `${fsize}px`);
}

function initializeChart() {
  svg.selectAll("*").remove();

  [margin_top, margin_right, margin_bottom, margin_left] = margins;
  [width, height] = get_dimensions("svg");
  globe_x = height / 2 + 100;
  globe_y = height / 2;

  ellipse_x = width - 2 * max_elipse_rx - 100;
  ellipse_y = 190;

  drawTitles();
  drawLegend();
  projection = d3
    .geoOrthographic()
    .scale(globe_radius)
    .translate([globe_x, globe_y])
    .precision(0.1);

  path = d3.geoPath().projection(projection);

  const graticule = d3.geoGraticule();

  svg
    .append("path")
    .datum(graticule)
    .attr("class", "graticule")
    .attr("d", path)
    .style("fill", "none")
    .style("stroke", "#ccc");

  const drag = d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);

  svg.call(drag);

  function dragstarted(event) {
    tooltip.style("opacity", 0);
    clearHighlight();
    d3.select(this).style("cursor", "grabbing");
  }

  function dragged(event) {
    const dx = event.dx;
    const dy = event.dy;

    rotation[0] += dx * 0.5;
    rotation[1] -= dy * 0.5;

    rotation[0] = (rotation[0] + dx * 0.5) % 360;
    rotation[1] = (rotation[1] - dy * 0.5) % 360;

    projection.rotate(rotation);
    svg.selectAll("path:not(.ellipse)").attr("d", path);

    tooltip.style("opacity", 0);
    clearHighlight();
  }

  function dragended(event) {
    d3.select(this).style("cursor", "default");
    tooltip.style("opacity", 0);
  }

  svg
    .append("circle")
    .attr("cx", globe_x)
    .attr("cy", globe_y)
    .attr("r", globe_radius)
    .attr("fill", "red")
    .style("opacity", 0.3);

  drawChart2();
}

function updateGlobe() {
  if (auto_rotate) {
    rotation[0] = (rotation[0] + 0.5) % 360;
  }

  projection.rotate(rotation);
  svg.selectAll("path:not(.ellipse)").attr("d", path);
  drawNorthPole();
  drawSouthPole();
  drawLines();
}

async function loadDataset() {
  return Promise.all([d3.csv(dataset_path, d3.autoType)]).then((values) => {
    // data = values[0];
    data = [];
    for (const row of values[0]) {
      // console.log(row);
      if (row["CRATER_NAME"] == null) continue;
      data.push(row);
    }
    console.log(data);
    min_depth = data[0][depth];
    max_depth = data[0][depth];
    min_diam = data[0][diam];
    max_diam = data[0][diam];
    for (const row of data) {
      min_depth = Math.min(min_depth, row[depth]);
      max_depth = Math.max(max_depth, row[depth]);
      min_diam = Math.min(min_diam, row[diam]);
      max_diam = Math.max(max_diam, row[diam]);
    }
    console.log(min_depth, max_depth);
    console.log(min_diam, max_diam);
  });
}

function initSliders() {
  $("#depth-range").slider({
    range: true,
    min: 0,
    max: 5,
    values: [0, 5],
    step: 0.01,
    slide: function (event, ui) {
      filterData();
      $("#depth").val(ui.values[0] + " - " + ui.values[1] + " KM");
    },
  });
  $("#depth").val(
    $("#depth-range").slider("values", 0) +
      " - " +
      $("#depth-range").slider("values", 1) +
      " KM"
  );

  $("#diam-range").slider({
    range: true,
    min: 100,
    max: 500,
    values: [100, 500],
    step: 0.01,
    slide: function (event, ui) {
      filterData();
      $("#diam").val(ui.values[0] + " - " + ui.values[1] + " KM");
    },
  });
  $("#diam").val(
    $("#diam-range").slider("values", 0) +
      " - " +
      $("#diam-range").slider("values", 1) +
      " KM"
  );
}

function filterData() {
  filtered_data = [];
  for (const row of data) {
    if (row[depth] < 1) continue;
    if (row[diam] < 100) continue;
    filtered_data.push(row);
  }

  min_depth = filtered_data[0][depth];
  max_depth = filtered_data[0][depth];
  min_diam = filtered_data[0][diam];
  max_diam = filtered_data[0][diam];
  for (const row of filtered_data) {
    min_depth = Math.min(min_depth, row[depth]);
    max_depth = Math.max(max_depth, row[depth]);
    min_diam = Math.min(min_diam, row[diam]);
    max_diam = Math.max(max_diam, row[diam]);
  }
  // console.log(min_depth, max_depth);
  // console.log(min_diam, max_diam);

  filtered_data.sort((a, b) => {
    // var keyA = new Date(a.updated_at),
    //   keyB = new Date(b.updated_at);
    // // Compare the 2 dates
    // if (keyA < keyB) return -1;
    // if (keyA > keyB) return 1;
    // return 0;
    return a[diam] < b[diam];
  });
}

document.addEventListener("DOMContentLoaded", function () {
  svg = d3.select("#svg");
  // svg.on("mouseover", () => clearHighlight());
  tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("opacity", 0);

  loadDataset().then(() => {
    initSliders();
    document.getElementById("autoRotate").checked = auto_rotate;
    document.getElementById("autoRotate").onchange = () => {
      auto_rotate = !auto_rotate;
    };
    filterData();
    initializeChart();

    d3.timer(updateGlobe);
  });
});

function drawSemiEllipse(rx = 200, ry = 100, row) {
  const cx = ellipse_x + max_elipse_rx;
  const cy = ellipse_y;

  svg
    .append("path")
    .attr("class", "ellipse")
    .attr("id", "ellipse_" + row["CRATER_ID"])
    .attr(
      "d",
      `M${cx - rx},${cy} A${rx},${ry} 0 0,0 ${cx + rx},${cy} L${
        cx + rx
      },${cy} ${cx - rx},${cy}`
    )
    // .style("fill", "rgba(0,0,0,0)")
    .style("stroke", "black")
    // .style("stroke-width", 2);
    .style("opacity", 0.4)
    .on("mouseover", function (event, d) {
      clearHighlight();
      event.target.classList.add("selected_ellipse");
      tooltip_visible = true;
      tooltip.style("opacity", 1);
      tooltip
        .html(
          `Crater Info:
        <br>ID: ${row["CRATER_ID"]}
        ${row["CRATER_NAME"] == null ? "" : "<br>Name: " + row["CRATER_NAME"]}
        <br>Lat: ${row[lat]}
        <br>Long: ${row[long]}
        <br>Diameter: ${row[diam]}
        <br>Depth: ${row[depth]}
        <br>Layers: ${row["NUMBER_LAYERS"]}`
        )
        .style("left", event.pageX + 30 + "px")
        .style("top", event.pageY - 50 + "px");
      document
        .getElementById("line_" + row["CRATER_ID"])
        .classList.add("selected_crater_line");
    })
    .on("mousemove", function (event, node) {
      tooltip
        .style("left", event.pageX + 30 + "px")
        .style("top", event.pageY - 50 + "px");
    })
    .on("mouseout", function (event, node) {
      tooltip_visible = false;
      tooltip.style("opacity", 0);

      document
        .getElementById("line_" + row["CRATER_ID"])
        .classList.remove("selected_crater_line");

      event.target.classList.remove("selected_ellipse");
    });
}

function drawChart2() {
  // console.log(filtered_data);

  for (const row of filtered_data) {
    // console.log(row);
    const rx = normalize(
      row[diam],
      [min_diam, max_diam],
      [max_elipse_rx * (min_diam / max_diam), max_elipse_rx]
    );
    const ry = normalize(
      row[depth],
      [min_depth, max_depth],
      [max_elipse_ry * (min_depth / max_depth), max_elipse_ry]
    );
    drawSemiEllipse(rx, ry, row);
  }
}

function clearHighlight() {
  $(".crater_line").removeClass("selected_crater_line");
  $(".ellipse").removeClass("selected_ellipse");
}
