class RSViz extends RSObject {
  BOX_SCALE = 5.0;
  HISTORY_LENGTH = 100;

  async setup() {
    this.computeLayout();
    this.showVideoWindow();
    //this.showBreakdownWindow();
    this.showGraphWindow();
    //this.showContextWindow();
    this.showJumboWindow();
    this.showRadarWindow();

    this.rs.scenes.addEventListener("sceneChanged", (e) =>
      this.changeScene(e.detail.scene)
    );
    this.rs.profiles.addEventListener("profileChanged", (e) =>
      this.changeProfile(e.detail.profile)
    );
  }

  start() {
    this.video.play();
    if (this.contextVideo) this.contextVideo.play();
    if (this.smoothie) this.smoothie.start();
  }

  async changeScene(scene) {
    await this.loadData(scene);
    this.video.src = await this.createDownloadUrl(scene.audienceVideo);
    this.timeSeries.clear();

    if (this.contextVideo) {
      if (scene.contextVideo) {
        document.getElementById("context_video_missing").style.display = "none";
        this.contextVideo.style.display = "block";
        this.contextVideo.src = await this.createDownloadUrl(
          scene.contextVideo
        );
      } else {
        document.getElementById("context_video_missing").style.display = "flex";
        this.contextVideo.style.display = "none";
        this.contextVideo.removeAttribute("src");
      }
    }

    this.applyProfile();
  }

  changeProfile(profile) {
    this.profile = profile;
    this.applyProfile();
  }

  applyProfile() {
    if (this.profile && this.data) {
      console.log("Applying profile");

      for (var row of this.data) {
        for (var emotion of row.emotions) {
          if (emotion.name in this.profile.emotions) {
            emotion.score =
              emotion.confidence * this.profile.emotions[emotion.name];
          }
        }
      }
      this.paintData = [];

      this.setupRadarChart();
    }
  }

  async loadData(scene) {
    if (scene && scene.results) {
      this.data = await this.fetchData(scene.results);

      this.currentIndex = 0;
      this.paintData = [];
      this.next = this.data[0];
    } else {
      console.error("Could not change scene, was empty or missing results");
    }
  }

  computeLayout() {
    var lo = this.lo || {};

    lo.videoX = lo.buffer;
    lo.videoY = lo.buffer + lo.navBarHeight;
    lo.videoWidth = lo.width * 0.5 - lo.buffer * 2;
    lo.videoHeight = lo.videoWidth / 1.777 + lo.titleHeight;

    lo.breakdownX = lo.videoX + lo.videoWidth + lo.buffer;
    lo.breakdownY = lo.videoY;
    lo.breakdownWidth = lo.width * 0.5 - lo.buffer;
    lo.breakdownHeight = lo.videoHeight;

    lo.graphX = lo.buffer;
    lo.graphY = lo.videoY + lo.videoHeight + lo.buffer;
    lo.graphWidth = lo.videoWidth;
    lo.graphHeight = lo.height - lo.videoHeight - lo.buffer;

    lo.contextX = lo.breakdownX;
    lo.contextY = lo.graphY;
    lo.contextWidth = lo.breakdownWidth;
    lo.contextHeight = lo.graphHeight;

    lo.jumboX = lo.contextX;
    lo.jumboY = lo.contextY;
    lo.jumboWidth = lo.contextWidth;
    lo.jumboHeight = lo.contextHeight;

    lo.radarX = lo.breakdownX;
    lo.radarY = lo.breakdownY;
    lo.radarWidth = lo.breakdownWidth;
    lo.radarHeight = lo.breakdownHeight;

    this.lo = lo;
    return lo;
  }

  //
  // VIDEO EVENTS
  //

  requestVideoFrameCallback() {
    this.videoFrameCallbackRunning = true;
    this.video.requestVideoFrameCallback((now, metadata) => {
      // The metadata mediaTime continues passed the duration when the video loops
      // To get the mediaTime relative to the video showing we need to subtract
      // the duration while it's over.
      var mediaTime = metadata.mediaTime % this.video.duration;

      this.handleMediaTime(mediaTime);
      this.requestVideoFrameCallback();
    });
  }

  findTimeIndex(time) {
    for (var i = 0; i < this.data.length - 1; i++) {
      if (this.data[i].time >= time) return i;
    }

    return -1;
  }

  handleMediaTime(mediaTime) {
    // While the video play time is passed the next frame of data, copy it into our
    // paintData array then increment the index.
    while (this.next && mediaTime > this.next.time) {
      this.currentIndex++;
      this.paintData.push(this.next);
      this.next = this.data[this.currentIndex];
    }

    // If we scrub then we need to reset currentIndex
    if (mediaTime < this.lastMediaTime || mediaTime - this.lastMediaTime > 1) {
      this.currentIndex = this.findTimeIndex(mediaTime);
      this.paintData = [];
      this.next = this.data[this.currentIndex];
      this.timeSeries.clear();
    }

    if (this.paintData.length > 0) {
      this.paintData = this.paintData.filter((row) => mediaTime - row.time < 1);
    }

    this.lastMediaTime = mediaTime;

    if (
      this.contextVideo &&
      this.contextVideo.src &&
      Math.abs(mediaTime - this.contextVideo.currentTime) > 1
    )
      this.contextVideo.currentTime = mediaTime;

    this.calculate();
    this.paint();
  }

  //
  // VISUALIZATION
  //

  calculate() {
    this.groupData();
    this.plotData();
  }

  paint() {
    this.paintHeatmap();
    this.paintBreakdown();
    this.paintGraph();
    this.paintJumbo();
    this.paintRadar();
  }

  makeGroups(data) {
    var grouped = {};
    var key;

    for (var row of data) {
      key = row.emotions[0].name;
      grouped[key] = grouped[key] || { emotion: key, count: 0, score: 0 };
      grouped[key].count++;
      grouped[key].score += row.emotions[0].score * 100;
    }

    var keys = Object.keys(grouped).sort(
      (a, b) => grouped[b].score - grouped[a].score
    );
    var result = {};
    result.groupedData = keys.map((k) => grouped[k]);
    result.totalScore = result.groupedData.reduce(
      (tot, row) => tot + row.score,
      0
    );
    result.totalCount = result.groupedData.reduce(
      (tot, row) => tot + row.count,
      0
    );
    result.total = (result.totalScore / result.totalCount) * 20;
    if (result.total > 2000) result.total = 2000;
    else if (result.total < -2000) result.total = -2000;
    else if (isNaN(result.total)) result.total = 0;

    return result;
  }

  groupData() {
    var result = this.makeGroups(this.paintData);
    this.groupedData = result.groupedData;
    this.total = result.total;
    this.totalCount = result.totalCount;
    this.totalScore = result.totalScore;
  }

  plotData() {
    this.history = this.history || [];
    this.history.push({
      time: this.lastMediaTime,
      score: this.total,
    });

    if (this.history.length > this.HISTORY_LENGTH) this.history.shift();

    var min = 99999999;
    var max = -99999999;
    //for (var point of this.history) {
    //    min = Math.min(point.score, min);
    //    max = Math.max(point.score, max);
    //}
    //
    max = 2000;
    min = -2000;

    this.history.forEach(
      (point) => (point.plot = (point.score - min) / (max - min))
    );
  }

  paintHeatmap() {
    var ctx = this.overlay.getContext("2d");
    ctx.clearRect(0, 0, 1920, 1050);
    //ctx.fillStyle = "rgba(64,64,64,0.333)";
    //ctx.fillRect(0,0, 1920, 1050);

    var videoWidthScale = this.video.videoWidth / this.video.width;
    var videoHeightScale = this.video.videoHeight / this.video.height;

    for (var i = 0; i < this.paintData.length; i++) {
      var row = this.paintData[i];

      // Don't heatmap zeros
      if (row.emotions[0].score == 0) continue;

      var w = (row.box.w / videoWidthScale) * this.BOX_SCALE;
      var h = (row.box.h / videoHeightScale) * this.BOX_SCALE;
      var x =
        row.box.x / videoWidthScale - (w - row.box.w / videoWidthScale) / 2;
      var y =
        row.box.y / videoHeightScale - (h - row.box.h / videoHeightScale) / 2;

      var centerX = x + w / 2;
      var centerY = y + h / 2;
      var innerR = 1;
      var outerR = h / 2;
      var hue = 64 + row.emotions[0].score * 64;

      var gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerR,
        centerX,
        centerY,
        outerR
      );
      gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, 50%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
    }
  }

  paintBreakdown() {
    if (!this.breakdown) return;

    var html = `<div><span class="total">RoarScore ${this.total.toFixed(
      2
    )}</span></div>`;

    for (var row of this.groupedData) {
      html +=
        `<div><span class="emotion">${row.emotion}</span>` +
        `<span class="count">x ${row.count}</span>` +
        `<span class="score">${row.score.toFixed(2)}</span></div>`;
    }

    this.breakdown.innerHTML = html;
  }

  paintGraph() {
    if (!this.graph || !this.smoothie || !this.timeSeries) return;
    if (!this.history || this.history.length < 2) return;

    var point = this.history[this.history.length - 1];
    var lastPoint = this.history[this.history.length - 2];

    if (point.score === lastPoint.score) return;

    this.timeSeries.append(Date.now(), point.score);
  }

  paintJumbo() {
    if (!this.jumbo || !this.jumbo_score) return;

    var w = this.jumbo.width;
    var h = this.jumbo.height;
    var ctx = this.jumbo.getContext("2d");
    var bars = 3;
    var historyStepSize = 10;
    var jitterSize = 5;

    //ctx.fillStyle = "black";
    ctx.clearRect(0, 0, w, h);

    if (
      !this.history ||
      !this.history.length ||
      this.history.length < bars * historyStepSize
    )
      return;

    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `hsl(0, 50%, 100%)`);
    gradient.addColorStop(0.5, `hsl(0, 100%, 50%)`);
    gradient.addColorStop(1, `hsl(64, 100%, 50%)`);

    for (var i = 0; i < bars; i++) {
      var jitter = Math.random() * jitterSize * 2 - jitterSize;
      var idx = this.history.length - (i * historyStepSize + 1);
      var val = this.history[idx].plot * h + jitter;

      if (this.history[idx].score == 0) val = 0.5 * h;

      var barWidth = w / 6;
      var barOffset = barWidth * i;
      var barX = w / 2 - barWidth / 2 - barOffset;
      var barX2 = w / 2 - barWidth / 2 + barOffset;
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, h - val, barWidth, val);
      if (i > 0) ctx.fillRect(barX2, h - val, barWidth, val);

      if (i == 0) {
        this.jumbo_score.innerText = Math.floor(this.history[idx].score);
      }
    }
  }

  paintRadar() {
    if (!this.radar || !this.radarChart) return;

    for (var row of this.groupedData) {
      if (!row.emotion || !row.score || !(row.emotion in this.radarDataMap))
        continue;
      var idx = this.radarDataMap[row.emotion];
      this.radarChart.data.datasets[0].data[idx] = Math.abs(row.score);
    }
    this.radarChart.update();
  }

  //
  // MAIN UI
  //

  showVideoWindow() {
    let lo = this.lo;
    const { div, span, video, canvas } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Audience Video",
          x: lo.videoX,
          y: lo.videoY,
          width: lo.videoWidth,
          height: lo.videoHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div(
          {
            id: "main_video_container",
            style: `width:${lo.videoWidth}px; height:${lo.videoHeight - 35}px`,
          },
          video({
            id: "main_video",
            controls: "controls",
            loop: "loop",
            muted: "muted",
            playsinline: "playsinline",
            width: 1920,
            height: 1080,
            style: `width:${lo.videoWidth}px; height:${lo.videoHeight - 35}px`,
          }),
          canvas({
            id: "main_video_overlay",
            width: 1920,
            height: 1000,
            style: `width:${lo.videoWidth}px; height:${lo.videoHeight - 75}px`,
          })
        )
      )
    );

    this.video = document.getElementById("main_video");
    this.overlay = document.getElementById("main_video_overlay");

    this.video.addEventListener("play", () => {
      if (!this.videoFrameCallbackRunning) this.requestVideoFrameCallback();

      if (
        this.contextVideo &&
        this.contextVideo.src &&
        this.contextVideo.paused
      )
        this.contextVideo.play();

      if (this.smoothie) this.smoothie.start();
    });

    this.video.addEventListener("pause", () => {
      if (
        this.contextVideo &&
        this.contextVideo.src &&
        !this.contextVideo.paused
      )
        this.contextVideo.pause();

      if (this.smoothie) this.smoothie.stop();
    });

    this.overlay.addEventListener("click", () => {
      if (this.video.paused) {
        this.video.muted = false; // Unmute on click
        this.video.play();
        if (this.smoothie) this.smoothie.start();
      } else {
        this.video.pause();
        if (this.smoothie) this.smoothie.stop();
      }
    });
  }

  showBreakdownWindow() {
    let lo = this.lo;
    const { div, span, input, p, button, h3, a } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Score Breakdown",
          x: lo.breakdownX,
          y: lo.breakdownY,
          width: lo.breakdownWidth,
          height: lo.breakdownHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div({ id: "breakdown" })
      )
    );

    this.breakdown = document.getElementById("breakdown");
  }

  showRadarWindow() {
    let lo = this.lo;
    const { div, canvas } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Radar",
          x: lo.radarX,
          y: lo.radarY,
          width: lo.radarWidth,
          height: lo.radarHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div(
          canvas({
            id: "radar",
            width: lo.radarWidth,
            height: lo.radarHeight - 40,
          })
        )
      )
    );

    this.radar = document.getElementById("radar");
  }

  setupRadarChart() {
    if (!this.radar || !this.data || !this.profile) return;
    var ctx = this.radar.getContext("2d");
    var init = this.getRadarInit();

    this.radarDataMap = {};
    for (var i = 0; i < init.length; i++) {
      this.radarDataMap[init[i].label] = i;
    }

    if (this.radarChart) this.radarChart.destroy();

    this.radarChart = new Chart(ctx, {
      type: "radar",
      data: {
        labels: init.map((emotion) => emotion.label),
        datasets: [
          {
            label: "T=0",
            data: init.map(() => 0),
            fill: true,
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderColor: "rgb(255, 99, 132)",
            pointBackgroundColor: "rgb(255, 99, 132)",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgb(255, 99, 132)",
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            suggestedMin: 0,
            suggestedMax: 100,
          },
        },
      },
    });
    this.radarChart.update();
  }

  getRadarInit() {
    if (!this.data || !this.profile) return [];

    var axes = {};
    var topScore = 0;

    // Iterate over the data and sum the absolute scores for each emotion
    for (var row of this.data) {
      for (var emotion of row.emotions) {
        if (emotion.name in this.profile.emotions) {
          axes[emotion.name] = axes[emotion.name] || {
            label: emotion.name,
            max: 0,
            total: 0,
          };
          axes[emotion.name].total += Math.abs(emotion.score);
          axes[emotion.name].max = Math.max(
            axes[emotion.name].max,
            Math.abs(emotion.score)
          );
        }
      }
    }

    // Sort the axes by score
    var sortedKeys = Object.keys(axes).sort((a, b) => axes[b] - axes[a]);

    // Take the top 8 emotions
    var topEmotions = sortedKeys.slice(0, 8);

    // Filter out any emotions that have a max score of 0
    topEmotions = topEmotions.filter((emotion) => axes[emotion].max > 0.5);

    return topEmotions.map((emotion) => axes[emotion]);
  }

  showGraphWindow() {
    let lo = this.lo;
    const { div, span, canvas } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Score over Time",
          x: lo.graphX,
          y: lo.graphY,
          width: lo.graphWidth,
          height: lo.graphHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div(
          span(
            {
              class: "vanui-window-cross",
              style:
                "position: absolute; top: 8px; right: 8px;cursor: pointer;",
              onclick: () => (closed.val = true),
            },
            "\u00D7"
          ),
          div(
            canvas({
              id: "graph",
              width: lo.graphWidth,
              height: lo.graphHeight - 40,
            })
          )
        )
      )
    );

    this.graph = document.getElementById("graph");
    this.smoothie = new SmoothieChart({
      interpolation: "bezier",
      grid: {
        strokeStyle: "rgb(125, 0, 0)",
        fillStyle: "rgb(60, 0, 0)",
        lineWidth: 1,
        millisPerLine: 1000,
        verticalSections: 6,
      },
      labels: {
        fillStyle: "rgb(255, 255, 0)",
        fontSize: 24,
        precision: 0,
        showIntermediateLabels: false,
      },
    });

    this.smoothie.streamTo(this.graph, 1000);
    window.setTimeout(() => this.smoothie.stop(), 10);
    this.timeSeries = new TimeSeries();
    this.smoothie.addTimeSeries(this.timeSeries, {
      strokeStyle: "rgb(0, 255, 0)",
      fillStyle: "rgba(0, 255, 0, 0.4)",
      lineWidth: 3,
    });
  }

  showJumboWindow() {
    let lo = this.lo;
    const { div, span, canvas } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Fan View",
          x: lo.jumboX,
          y: lo.jumboY,
          width: lo.jumboWidth,
          height: lo.jumboHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div(
          span(
            {
              class: "vanui-window-cross",
              style:
                "position: absolute; top: 8px; right: 8px;cursor: pointer;",
              onclick: () => (closed.val = true),
            },
            "\u00D7"
          ),
          div(
            {
              id: "jumbo_container",
              style: `width:${lo.graphWidth}px; height:${
                lo.graphHeight - 35
              }px`,
            },
            canvas({
              id: "jumbo",
              width: lo.graphWidth - 25,
              height: lo.graphHeight - 35,
            }),
            div({
              id: "jumbo_score",
              style: `width:${lo.graphWidth - 25}px; height:${
                lo.graphHeight - 35
              }px;`,
            })
          )
        )
      )
    );

    this.jumbo = document.getElementById("jumbo");
    this.jumbo_score = document.getElementById("jumbo_score");
  }

  showContextWindow() {
    let lo = this.lo;
    const { div, span, video } = van.tags;

    van.add(
      document.body,
      FloatingWindow(
        {
          title: "Game context",
          x: lo.contextX,
          y: lo.contextY,
          width: lo.contextWidth,
          height: lo.contextHeight,
          childrenContainerStyleOverrides: { padding: 0 },
        },
        div(
          video({
            id: "context_video",
            loop: "loop",
            muted: "muted",
            playsinline: "playsinline",
            width: 1920,
            height: 1080,
            style: `width:${lo.contextWidth}px; height:${
              lo.contextHeight - 35
            }px`,
          }),
          div(
            {
              id: "context_video_missing",
              style: `width:${lo.contextWidth}px; height:${
                lo.contextHeight - 35
              }px; display: none; justify-content: center; align-items: center;`,
            },
            span("No context video available")
          )
        )
      )
    );

    this.contextVideo = document.getElementById("context_video");
  }
}
