"use strict";

const byId = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const pressed = (element, selected) => element.setAttribute("aria-pressed", String(selected));
function makeButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

// Local hash navigation gives every exhibit a shareable location and supports Back.
const menu = document.querySelector(".menu-button");
const nav = byId("mainNav");
function closeMenu() {
  nav.classList.remove("is-open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  menu.querySelector("use").setAttribute("href", "#i-menu");
}
menu.addEventListener("click", () => {
  if (nav.classList.contains("is-open")) return closeMenu();
  nav.classList.add("is-open");
  menu.setAttribute("aria-expanded", "true");
  menu.setAttribute("aria-label", "Close navigation");
  menu.querySelector("use").setAttribute("href", "#i-close");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && nav.classList.contains("is-open")) {
    closeMenu();
    menu.focus();
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header") || event.target.closest("nav a")) closeMenu();
});
const views = all(".view");
function route(focusContent = true) {
  const anchor = location.hash.slice(1) || "home";
  const page = views.find(view => view.id === anchor) || byId("home");
  views.forEach(view => { view.hidden = view !== page; });
  const section = ["signals", "atlas", "home"].includes(page.id) ? "collection" :
    ["brainshift", "network", "flow"].includes(page.id) ? "lab" : page.id;
  all(".bar a").forEach(link => {
    if (link.hash === "#" + section) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = page.id === "home" ? "NeuroScope · The neuroscience museum" :
    page.querySelector("h1").textContent + " · NeuroScope";
  closeMenu();
  if (anchor === "collection") {
    byId("collection").scrollIntoView();
    if (focusContent) {
      byId("collectionTitle").tabIndex = -1;
      byId("collectionTitle").focus({preventScroll: true});
    }
  } else {
    window.scrollTo(0, 0);
    if (focusContent) byId("main").focus({preventScroll: true});
  }
}
document.addEventListener("click", event => {
  const link = event.target.closest("a[href^='#']");
  if (!link || link.classList.contains("skip") || event.defaultPrevented ||
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== link.hash) {
    try {
      history.pushState(null, "", link.hash);
    } catch {
      // Some browsers restrict History API changes for local files.
      location.hash = link.hash;
      return;
    }
  }
  route();
});
window.addEventListener("hashchange", () => route());
document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  byId("main").focus();
  byId("main").scrollIntoView();
});

const specimens = [
  ["hero-brain", "Human brain", "Lateral view", "Lavender sculptural illustration of a human brain in lateral view"],
  ["neuron", "Multipolar neuron", "Cell structure", "Club illustration of a pink multipolar neuron with a myelinated axon"],
  ["coronal", "Brain section", "Coronal view", "A coronal section showing the two hemispheres and internal structures"]
];
let currentSpecimen = 0;
function switchSpecimen(step) {
  currentSpecimen = (currentSpecimen + step + specimens.length) % specimens.length;
  const [file, title, view, description] = specimens[currentSpecimen];
  all(".landmark").forEach(link => { link.hidden = currentSpecimen !== 0; });
  byId("showImage").src = "" + file + ".webp";
  byId("showImage").alt = description;
  const detail = document.createElement("small");
  detail.textContent = "/ " + view;
  byId("specLabel").replaceChildren(title + " ", detail);
  byId("slideCount").textContent = "0" + (currentSpecimen + 1) + " / 03";
}
byId("slidePrev").onclick = () => switchSpecimen(-1);
byId("slideNext").onclick = () => switchSpecimen(1);
all("[data-filter]").forEach(button => button.onclick = () => {
  all("[data-filter]").forEach(option => pressed(option, option === button));
  const category = button.dataset.filter;
  let count = 0;
  all(".exhibit").forEach(card => {
    card.hidden = category !== "All exhibits" && card.dataset.category !== category;
    if (!card.hidden) count++;
  });
  byId("filterStatus").textContent = count + (count === 1 ? " exhibit" : " exhibits") + " shown.";
});

const regions = [
  ["Frontal lobe", "Helps plan actions, shape decisions, and control voluntary movement. Reaching for a cup draws on frontal circuits working with sensory and movement networks.", 23, 31],
  ["Parietal lobe", "Combines information about touch, body position, and space. It helps you tell where your hand is even when your eyes are closed.", 56, 24],
  ["Temporal lobe", "Helps process sound, understand language, and form memories. Listening to a familiar voice draws on several of these networks.", 45, 54],
  ["Occipital lobe", "Processes visual information near the back of the brain. Its circuits help other regions interpret shapes, motion, and color.", 85, 40],
  ["Cerebellum", "Fine-tunes movement, balance, and timing. It helps compare a planned movement with what your body actually does.", 74, 71]
];
function chooseRegion(index) {
  byId("regionTitle").textContent = regions[index][0];
  byId("regionText").textContent = regions[index][1];
  all("[data-region]").forEach(button => pressed(button, Number(button.dataset.region) === index));
}
regions.forEach(([name, , x, y], i) => {
  const pin = makeButton(String(i + 1), () => chooseRegion(i), "pin");
  pin.style.left = x + "%";
  pin.style.top = y + "%";
  pin.dataset.region = i;
  pin.setAttribute("aria-label", "Locate " + name);
  byId("brainPins").append(pin);
  const choice = makeButton((i + 1) + " · " + name, () => chooseRegion(i));
  choice.dataset.region = i;
  byId("regionButtons").append(choice);
});
all("[data-open-region]").forEach(link => link.addEventListener("click", () => {
  chooseRegion(Number(link.dataset.openRegion));
}));
chooseRegion(0);

const stimulus = byId("stimulus");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const axonRoute = byId("axonRoute");
const signed = value => value < 0 ? "−" + Math.abs(value) : (value > 0 ? "+" : "") + value;
let traceWidth = 700;
let animationFrame = 0;
const graphX = time => 45 + (traceWidth - 61) * time / 8;
const graphY = voltage => 14 + (40 - voltage) * .88;
function graphElement(name, attrs, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text;
  return element;
}
function drawAxes() {
  const grid = byId("graphGrid");
  grid.replaceChildren();
  const endX = graphX(8);
  for (const voltage of [30, 0, -55, -70]) {
    const y = graphY(voltage);
    const threshold = voltage === -55;
    grid.append(graphElement("line", {x1:45, x2:endX, y1:y, y2:y, stroke:threshold ? "#9d6795" : "#e9e4ee", "stroke-dasharray":threshold ? "5 4" : "none"}));
    grid.append(graphElement("text", {x:36, y:y+3, "text-anchor":"end"}, signed(voltage)));
  }
  grid.append(graphElement("text", {x:5, y:13}, "mV"));
  for (const t of [0,2,4,6,8]) {
    grid.append(graphElement("text", {x:graphX(t), y:143, "text-anchor":"middle"}, String(t)));
  }
  grid.append(graphElement("text", {x:graphX(4), y:161, "text-anchor":"middle"}, "Time (ms)"));
}
// Piecewise landmarks describe a single example stimulus, measured at axon onset.
function signalResponse(input) {
  const fires = input >= 15;
  const onset = fires ? 1 + 1.8 * 15 / input : 2.8;
  const landmarks = fires
    ? [[0,-70],[1,-70],[onset,-55],[onset+.48,30],[onset+1.63,-77],[onset+3.3,-70],[8,-70]]
    : [[0,-70],[1,-70],[2.8,-70+input],[5.8,-70],[8,-70]];
  function voltageAt(t) {
    for (let i=1; i<landmarks.length; i++) {
      const [end,v2]=landmarks[i];
      if (t <= end) {
        const [start,v1]=landmarks[i-1];
        const f=(t-start)/(end-start);
        return v1+(v2-v1)*f*f*(3-2*f);
      }
    }
    return -70;
  }
  return {fires, onset, voltageAt};
}
function updateSignal(play) {
  cancelAnimationFrame(animationFrame);
  const input = Number(stimulus.value);
  const {fires,onset,voltageAt} = signalResponse(input);
  const state = fires ? "Action potential" : input > 0 ? "Below threshold" : input < 0 ? "Inhibited" : "At rest";
  const detail = fires ? "Threshold crossed. The spike peaks at +30 mV and an impulse travels to the terminals." :
    input === 0 ? "The membrane is at −70 mV. Move the slider to give the cell an input." :
    input < 0 ? "The membrane falls to " + signed(-70+input) + " mV, farther from firing threshold." :
    "The membrane reaches " + signed(-70+input) + " mV. Add " + (15-input) + " mV more excitation to trigger a spike.";
  byId("neuronState").textContent = state;
  byId("responseText").textContent = detail;
  byId("inputValue").textContent = signed(input) + " mV";
  stimulus.setAttribute("aria-valuetext", signed(input) + " millivolts, " + state);
  byId("graphDesc").textContent = detail;
  byId("neuronFigure").setAttribute("aria-label", "Club neuron illustration. " + detail);
  byId("traceCaption").textContent = fires ? "Depolarization → repolarization → brief undershoot → rest" :
    input === 0 ? "Resting voltage stays at −70 mV." : input < 0 ? "The input produces a downward deflection, followed by recovery." : "A graded depolarization rises below the dashed threshold and returns to rest.";
  byId("axonCaption").textContent = fires ? "Signal path · axon to terminals" : state + " · no traveling impulse";
  byId("somaResponse").setAttribute("opacity", Math.min(.32,Math.abs(input)/60));
  byId("somaResponse").setAttribute("fill", input < 0 ? "#3d75c0" : "#a64594");
  axonRoute.setAttribute("opacity", fires ? ".6" : "0");
  byId("replaySignal").disabled = input === 0;
  const trace = [];
  for (let sample=0; sample<=320; sample++) {
    const t=8*sample/320;
    trace.push((sample ? "L" : "M")+graphX(t).toFixed(1)+" "+graphY(voltageAt(t)).toFixed(2));
  }
  byId("voltageTrace").setAttribute("d",trace.join(" "));
  const impulse=byId("axonImpulse"), point=byId("graphPoint"), cursor=byId("graphCursor");
  function positionImpulse(fraction) {
    const p=axonRoute.getPointAtLength(axonRoute.getTotalLength()*fraction);
    impulse.setAttribute("transform","translate("+p.x+" "+p.y+")");
  }
  const animate = play && input !== 0 && !reduceMotion.matches;
  cursor.setAttribute("visibility",animate ? "visible" : "hidden");
  point.setAttribute("visibility",animate ? "visible" : "hidden");
  impulse.setAttribute("visibility",fires && !animate ? "visible" : "hidden");
  if (!animate) { if (fires) positionImpulse(1); return; }
  const start=performance.now();
  function frame(now) {
    if (byId("signals").hidden) return;
    const t=Math.min(8,(now-start)*8/2600);
    const x=graphX(t);
    cursor.setAttribute("x1",x);cursor.setAttribute("x2",x);
    point.setAttribute("cx",x);point.setAttribute("cy",graphY(voltageAt(t)));
    if (fires && t >= onset) {
      impulse.setAttribute("visibility","visible");
      positionImpulse(Math.min(1,(t-onset)/3));
    }
    if (t < 8) animationFrame=requestAnimationFrame(frame);
  }
  animationFrame=requestAnimationFrame(frame);
}
stimulus.oninput = () => updateSignal(true);
byId("replaySignal").onclick = () => updateSignal(true);
byId("neuronReset").onclick = () => { stimulus.value=0; updateSignal(false); };
function sizeGraph() {
  const width = Math.round(byId("traceGraph").getBoundingClientRect().width);
  if (width > 0 && width !== traceWidth) {
    traceWidth=width;
    byId("traceGraph").setAttribute("viewBox","0 0 "+width+" 165");
    drawAxes();
    updateSignal(false);
  }
}
new ResizeObserver(sizeGraph).observe(byId("traceGraph"));
drawAxes();
updateSignal(false);

const seizureInfo = '<h3>Seizure first aid</h3><p>Stay nearby and time the seizure. Clear away hazards. If the person is lying down, gently roll them onto their side with their mouth toward the ground. Let their body move freely and keep objects out of their mouth.</p><p>In the U.S., call <strong>911</strong> for a seizure over five minutes, a quick repeat, injury, or trouble breathing or waking afterward. Also call for a seizure in water, a first seizure, pregnancy, or diabetes with loss of consciousness.</p><a class="source" href="https://www.cdc.gov/epilepsy/first-aid-for-seizures/index.html">CDC · First aid for seizures</a>';
const conditions = {
  epilepsy: {
    title: "Epilepsy", topic: "Seizures & networks",
    intro: "A seizure is a temporary change in brain activity that can affect awareness, movement, or sensation. Epilepsy is a condition that can cause repeated seizures.",
    example: "A seizure may look like a few seconds of staring or confusion. Some cause falls and shaking. One seizure alone does not always mean someone has epilepsy.",
    support: "Ask how you can support the person and learn their seizure action plan if they want to share it.",
    link: "https://www.cdc.gov/epilepsy/about/index.html", source: "CDC · About epilepsy",
    aside: seizureInfo, activity: "network", cta: "Practice first aid"
  },
  adhd: {
    title: "ADHD", topic: "Attention & development",
    intro: "Attention-deficit/hyperactivity disorder is a neurodevelopmental condition. It can affect attention, activity level, and impulse control in different ways.",
    example: "One person might often lose track of instructions. Another might find waiting for a turn especially difficult. A person's needs can change over time.",
    support: "Ask what helps. A short written instruction, a quieter workspace, or breaking a task into steps may make participation easier.",
    link: "https://www.cdc.gov/adhd/about/index.html", source: "CDC · About ADHD",
    aside: "<h3>Try changing the cue</h3><p>Play a round of BrainShift, then try it with extra rule cues. Notice which information you use when the rule changes.</p><p>The game explores one task. ADHD diagnosis takes a broader clinical evaluation.</p>",
    activity: "brainshift", cta: "Play BrainShift"
  },
  stroke: {
    title: "Stroke", topic: "Brain circulation",
    intro: "A stroke occurs when a blockage interrupts blood flow to part of the brain or when a blood vessel ruptures and bleeds. Both are emergencies.",
    example: "A sudden change in balance, vision, facial movement, arm strength, or speech can be a warning sign. Symptoms that clear quickly still need urgent care.",
    support: "Call emergency services and note when symptoms began, or when the person was last known to be well.",
    link: "https://www.stroke.org/en/about-stroke/stroke-symptoms", source: "American Stroke Association · Stroke symptoms",
    aside: "<h3>Time to call 911</h3><p>In the U.S., call <strong>911 immediately</strong> at the first sudden warning sign of stroke, even if it disappears. An ambulance team can start care on the way to the hospital.</p><p>B.E. F.A.S.T. stands for Balance, Eyes, Face, Arm, Speech, and Time.</p>",
    activity: "flow", cta: "Explore BrainFlow"
  }
};
function showCondition(key) {
  const c = conditions[key];
  // Each lesson uses fixed editorial content. Visitor messages are always text nodes.
  byId("conditionLesson").innerHTML = '<div class="panel"><div class="micro">' + c.topic +
    '</div><h2>' + c.title + '</h2><p>' + c.intro + '</p><h3>What it can look like</h3><p>' +
    c.example + '</p><h3>How to help</h3><p>' + c.support + '</p><a class="source" href="' +
    c.link + '">' + c.source + '</a></div><aside class="guidance">' + c.aside +
    '<p><a class="button" href="#' + c.activity + '">' + c.cta + '</a></p></aside>';
  all("[data-condition]").forEach(button => pressed(button, button.dataset.condition === key));
}
all("[data-condition]").forEach(button => button.onclick = () => showCondition(button.dataset.condition));
showCondition("epilepsy");

function contextFor(canvas, width, height) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return ctx;
}
function line(ctx, x, y, endX, endY, color, width) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function dot(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}
function smallNeuron(ctx, x, y, size, color, angle) {
  for (let arm = 0; arm < 5; arm++) {
    const a = angle + arm * 1.2566;
    const endX = x + Math.cos(a) * size, endY = y + Math.sin(a) * size;
    line(ctx, x, y, endX, endY, color, 1.7);
    for (const branch of [-.65, .65]) {
      line(ctx, endX, endY, endX + Math.cos(a + branch) * size * .52,
        endY + Math.sin(a + branch) * size * .52, color, 1.2);
    }
  }
  dot(ctx, x, y, size * .38, color);
}
const nodes = [[43,60],[45,142],[109,38],[112,101],[119,169],[184,65],[190,141],[258,30],[263,107],[270,169],[328,60],[335,141]];
function drawNetwork(synchronized) {
  const ctx = contextFor(byId("networkDiagram"), 380, 210);
  nodes.forEach(([x,y], i) => {
    nodes.slice(i + 1).forEach(([a,b]) => {
      if (Math.hypot(a-x,b-y) < 106) line(ctx, x,y,a,b,"#bda6ce",1.15);
    });
  });
  nodes.forEach(([x,y], i) => {
    const active = synchronized || i % 3 === 0;
    if (active) { dot(ctx,x,y,15,"#d6c4e8"); dot(ctx,x,y,10,"#e9def3"); }
    smallNeuron(ctx,x,y,8,active ? "#6e3c99" : "#a89bb3",i);
  });
  const description = synchronized ? "All highlighted nodes are active at the same instant. Some seizures involve excessive synchronization, but synchronization alone does not establish that a seizure is occurring." :
    "Only a subset of nodes is active at this instant. Different groups can take part at different times.";
  byId("netDesc").textContent = description;
  byId("networkDiagram").setAttribute("aria-label", description);
  all("[data-sync]").forEach(button => pressed(button, Number(button.dataset.sync) === Number(synchronized)));
}
all("[data-sync]").forEach(button => button.onclick = () => drawNetwork(button.dataset.sync === "1"));
drawNetwork(false);

const rescue = [
  ["A seizure begins near a chair. What helps first?", ["Move the chair away and stay nearby.", "Hold the person's arms still.", "Put a spoon between their teeth."], 0, "Clear hard objects, time the seizure, and stay with the person. Restraint and objects in the mouth can injure them."],
  ["The seizure has lasted longer than five minutes. What now?", ["Wait until ten minutes have passed.", "Call 911 in the U.S.", "Offer water right away."], 1, "Call 911. The length of this seizure is a reason to get emergency help."],
  ["The person is lying down. How can you help keep their airway clear?", ["Give them a drink.", "Gently turn them onto their side.", "Hold their jaw closed."], 1, "Turn them gently onto their side with their mouth toward the ground. Wait until they are fully alert before offering food or water."]
];
let question = 0;
function showRescue() {
  const [prompt, answers, correct, explanation] = rescue[question];
  byId("aidQuestion").textContent = prompt;
  byId("aidCount").textContent = "First-aid challenge · " + (question + 1) + " / " + rescue.length;
  byId("aidFeedback").textContent = "";
  byId("aidNext").disabled = true;
  byId("aidNext").textContent = question === rescue.length - 1 ? "Restart challenge" : "Next question";
  byId("aidAnswers").replaceChildren();
  answers.forEach((answer, i) => {
    const button = makeButton(answer, () => {
      [...byId("aidAnswers").children].forEach((item, j) => {
        item.disabled = true;
        if (j === correct) item.classList.add("choices-good");
        else if (j === i) item.classList.add("choices-wrong");
      });
      byId("aidFeedback").textContent = (i === correct ? "Correct. " : "Here's what helps. ") + explanation;
      byId("aidNext").disabled = false;
      byId("aidNext").focus({preventScroll: true});
    }, "choice");
    byId("aidAnswers").append(button);
  });
}
byId("aidNext").onclick = () => {
  question = (question + 1) % rescue.length;
  showRescue();
  byId("aidAnswers").firstElementChild.focus({preventScroll: true});
};
showRescue();

const creatures = [
  ["creature", true, false], ["creature-horns", false, true],
  ["creature-both", true, true], ["creature-plain", false, false]
];
const deck = [0,1,2,3,1,0,2,3,1,0,3,2];
let trial = 0, score = 0;
const creatureImage = byId("creatureImage");
function renderGame() {
  const complete = trial === deck.length;
  byId("gameYes").disabled = byId("gameNo").disabled = complete;
  byId("gameScore").textContent = "Correct: " + score;
  byId("gameProgress").textContent = complete ? "Round complete" : "Creature " + (trial + 1) + " of 12";
  if (complete) {
    byId("gameRule").textContent = "Round complete";
    byId("gameCue").textContent = "You matched " + score + " of 12 creatures to the current rule.";
    return;
  }
  const [file, wings, horns] = creatures[deck[trial]];
  creatureImage.src = "" + file + ".webp";
  creatureImage.alt = "A creature with " + (wings ? "two wings" : "no wings") + " and " + (horns ? "two horns." : "no horns.");
  const feature = Math.floor(trial / 3) % 2 === 0 ? "wings" : "horns";
  byId("gameRule").textContent = "Does it have " + feature + "?";
  byId("gameCue").textContent = byId("supportMode").checked ? "Look for " + feature + " only. Ignore the other features." :
    (trial > 0 && trial % 3 === 0 ? "Rule change. Read the new question before you choose." : "Look closely, then choose your answer.");
}
function gameAnswer(yes) {
  if (trial >= deck.length) return;
  const featureIndex = Math.floor(trial / 3) % 2 + 1;
  const expected = creatures[deck[trial]][featureIndex];
  const feature = featureIndex === 1 ? "wings" : "horns";
  const correct = yes === expected;
  if (correct) score++;
  const feedback = byId("gameFeedback");
  feedback.dataset.result = correct ? "correct" : "incorrect";
  const title = document.createElement("strong");
  title.textContent = (correct ? "✓ Correct" : "× Incorrect") + " · Creature " + (trial + 1);
  const reason = document.createElement("span");
  reason.textContent = "It had " + (expected ? "" : "no ") + feature + ".";
  feedback.replaceChildren(title, reason);
  trial++;
  renderGame();
  if (trial === deck.length) byId("gameReset").focus({preventScroll: true});
}
byId("gameYes").onclick = () => gameAnswer(true);
byId("gameNo").onclick = () => gameAnswer(false);
byId("supportMode").onchange = renderGame;
byId("gameBoard").addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  e.preventDefault();
  if (!e.repeat) gameAnswer(e.key === "ArrowLeft");
});
byId("gameReset").onclick = () => {
  trial = score = 0;
  byId("gameFeedback").replaceChildren();
  delete byId("gameFeedback").dataset.result;
  byId("supportMode").checked = false;
  renderGame();
};
renderGame();

const signs = [
  ["B", "Balance", "Sudden dizziness, loss of balance, or trouble coordinating movement."],
  ["E", "Eyes", "Sudden trouble seeing with one or both eyes. Vision may be blurry or double."],
  ["F", "Face", "One side of the face suddenly droops or feels numb. A smile may appear uneven."],
  ["A", "Arm", "One arm suddenly feels weak or numb. When both arms are raised, one may drift down."],
  ["S", "Speech", "Speech may sound slurred. The person may have sudden difficulty speaking or understanding."],
  ["T", "Time", "Call 911 immediately in the U.S., even if symptoms go away. Note when the person was last known to be well."]
];
function showSign(i) {
  byId("fastTitle").textContent = signs[i][0] + " — " + signs[i][1];
  byId("fastText").textContent = signs[i][2];
  [...byId("fastButtons").children].forEach((button,j) => pressed(button, i === j));
}
signs.forEach(([letter, name], i) => {
  const button = makeButton(letter, () => showSign(i));
  button.setAttribute("aria-label", letter + " · " + name);
  byId("fastButtons").append(button);
});
showSign(0);
let blocked = false;
function renderFlow() {
  const canvas = byId("flowDiagram");
  const ctx = contextFor(canvas,380,215);
  for (const direction of [-1,1]) {
    ctx.save();
    ctx.translate(190,0);ctx.scale(direction,1);
    ctx.beginPath();ctx.moveTo(12,141);ctx.bezierCurveTo(5,107,8,49,30,30);
    ctx.bezierCurveTo(70,0,152,23,159,77);ctx.bezierCurveTo(184,127,144,179,103,179);
    ctx.bezierCurveTo(58,188,15,173,12,141);
    ctx.fillStyle = blocked && direction === 1 ? "#e1dbe4" : "#ded0ec";ctx.fill();
    ctx.strokeStyle="#b8a0c6";ctx.lineWidth=1.4;ctx.stroke();
    ctx.strokeStyle = blocked && direction === 1 ? "#9e91aa" : "#a74f79";
    ctx.lineWidth=5;
    ctx.stroke(new Path2D("M0 200 V153 Q21 137 52 116 T103 69 M52 116 Q76 130 116 143 M83 91 Q67 72 75 51 M103 69 L124 52 M103 69 L132 86 M116 143 L144 132 M116 143 L132 159"));
    if (blocked && direction === 1) {
      dot(ctx,40,124,9,"#643546");line(ctx,36,120,44,128,"#fff",2);line(ctx,36,128,44,120,"#fff",2);
    }
    ctx.restore();
  }
  const status = blocked ? "One branch blocked" : "Both branches open";
  byId("flowStatus").textContent = status;
  byId("flowDesc").textContent = blocked ? "The right branch no longer supplies its modeled region. The other branch remains open." : "Blood reaches both regions through open branches.";
  canvas.setAttribute("aria-label", status + ". " + byId("flowDesc").textContent);
  byId("blockFlow").textContent = blocked ? "Restore flow" : "Block a branch";
  pressed(byId("blockFlow"), blocked);
}
byId("blockFlow").onclick = () => { blocked = !blocked; renderFlow(); };
renderFlow();

const scaffold = [[209,177],[180,166],[159,163],[225,164],[170,148],[175,130],[169,181],[192,152],[150,179],[202,135],[185,193],[245,164],[248,184],[219,147],[202,115],[263,161],[237,143],[221,129],[227,189],[250,126],[267,119],[135,192],[129,212],[213,99],[141,152],[268,138],[130,171],[286,128],[288,146],[150,132],[153,114],[204,83],[135,112],[289,110],[129,129],[109,127],[270,101],[99,142],[230,107],[129,94],[164,99],[235,89],[255,91],[85,130],[225,73],[111,108],[141,79],[125,68],[66,127],[97,96],[182,101],[80,103],[110,82],[99,162],[267,77],[62,108],[178,82],[114,52],[183,63],[44,107],[102,182],[65,89],[82,82],[159,81],[203,58],[166,54],[94,58],[107,202],[118,151],[299,92],[44,131],[231,53],[81,160],[248,59],[79,181],[125,34],[25,142],[143,47],[235,210],[62,154],[288,167],[42,157],[276,182],[23,162],[306,169],[312,148],[319,187],[228,229],[313,128],[246,236],[326,168],[320,111],[259,223],[279,224],[335,152],[222,248],[338,133],[275,244],[278,202],[331,201],[260,204],[355,156],[290,254],[301,238],[317,226],[260,257],[290,274],[301,217],[238,261],[368,143],[325,243],[210,262],[387,146],[384,128],[374,112],[354,111],[271,279],[342,97],[190,258],[341,230],[363,94],[299,198],[172,262],[310,261],[207,233],[191,222],[183,241],[153,259],[249,279],[231,284],[162,242],[284,296],[146,26],[384,88],[382,167],[381,186],[134,264],[397,177],[397,112],[372,72],[119,248],[167,223],[399,195],[136,242],[157,208],[163,20],[357,57],[348,74],[148,224],[321,86],[388,214],[395,234],[373,229],[186,41],[389,251],[369,250],[416,225],[197,26],[349,259],[360,212],[242,303],[264,308],[111,227],[56,180],[91,222],[79,206],[258,325],[334,55],[419,207],[61,218],[328,276],[327,36],[210,8],[53,199],[311,288],[209,204],[314,58],[311,308],[296,67],[329,303],[348,303],[294,48],[270,49],[256,30],[238,26],[306,27],[218,28],[421,181],[259,8],[358,287],[33,213],[30,188],[378,273],[279,13],[282,33],[412,157],[230,8],[350,182],[411,137]];
const themeColors = {respect:"#f8d38c",epilepsy:"#dbadff",adhd:"#8fdbeb",stroke:"#ffa0b6"};
const contributions = [];
const anatomy = new Image();
const gallery = byId("brainDialog");
let zoom = 1, panX = 0, panY = 0, growthFrame = 0;
const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const scaffoldLinks = [];
const neighbors = scaffold.map((point,i) => {
  const nearest = scaffold.map((other,j) => ({j,d:distance(point,other)}))
    .filter(candidate => candidate.j !== i).sort((a,b) => a.d-b.d).slice(0,4);
  nearest.forEach(({j}) => {
    if (!scaffoldLinks.some(pair => pair[0] === j && pair[1] === i)) scaffoldLinks.push([i,j]);
  });
  return nearest.map(item => item.j);
});
function fiber(ctx,a,b,seed,color,weight,progress=1) {
  const x=b[0]-a[0], y=b[1]-a[1];
  const bend=Math.sin(seed*9.71)*.17;
  const midX=a[0]+x*.5-y*bend, midY=a[1]+y*.5+x*bend;
  const qx=a[0]+(midX-a[0])*progress, qy=a[1]+(midY-a[1])*progress;
  const ex=(1-progress)*qx+progress*(midX+(b[0]-midX)*progress);
  const ey=(1-progress)*qy+progress*(midY+(b[1]-midY)*progress);
  ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(qx,qy,ex,ey);
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();
}
function newBranch(index) {
  const slot = index % scaffold.length;
  const center = scaffold[slot];
  if (index < scaffold.length) return center;
  // Between established roots, each successive layer introduces a finer branch.
  const layer = Math.floor(index / scaffold.length);
  const tip = scaffold[neighbors[slot][(layer-1)%neighbors[slot].length]];
  const f=.15+.7*((layer*.618033989+slot*.37)%1);
  return [center[0]+(tip[0]-center[0])*f,center[1]+(tip[1]-center[1])*f];
}
function drawBrain(canvas,preview=false,growth=1) {
  const ctx=contextFor(canvas,576,420);
  ctx.fillStyle="#281a39";ctx.fillRect(0,0,576,420);
  const glow=ctx.createRadialGradient(286,187,10,286,187,300);
  glow.addColorStop(0,"#523761");glow.addColorStop(1,"#261933");
  ctx.fillStyle=glow;ctx.fillRect(0,0,576,420);
  for(let x=8;x<576;x+=16)for(let y=8;y<420;y+=16)dot(ctx,x,y,.6,"#d2bbeb30");
  ctx.save();
  if(canvas === byId("wideBrain")){
    ctx.translate(288+panX,210+panY);ctx.scale(zoom,zoom);ctx.translate(-288,-210);
  }
  ctx.translate(63,37);
  if(anatomy.complete && anatomy.naturalWidth){
    ctx.globalAlpha=.58;
    ctx.drawImage(anatomy,0,0,450,347);
    ctx.globalAlpha=1;
  }
  // Fine fibers follow the anatomical silhouette even before visitors add cells.
  for(const [a,b] of scaffoldLinks) fiber(ctx,scaffold[a],scaffold[b],a+b,"#e0c5f171",.65);
  scaffold.forEach(([x,y],i)=>{dot(ctx,x,y,i%5===0 ? 1.55 : 1.05,"#f4d9fbcd");});
  const entries=preview ? scaffold.slice(0,23).map((point,i)=>({point,theme:Object.keys(themeColors)[i%4]})) : contributions;
  entries.forEach((entry,i)=>{
    const color=themeColors[entry.theme], a=entry.point, slot=i%scaffold.length;
    const progress=i===entries.length-1 ? growth : 1;
    for(const neighbor of neighbors[slot].slice(0,3)) fiber(ctx,a,scaffold[neighbor],neighbor,color,1.35,progress);
    if(entry.parent)fiber(ctx,a,entry.parent,i,color,1.6,progress);
    dot(ctx,...a,5.9,color+"40");dot(ctx,...a,2.65,color);dot(ctx,...a,1.05,"#fff6e9");
  });
  if(entries.length && !preview){
    const last=entries[entries.length-1];
    ctx.beginPath();ctx.arc(...last.point,7.3+(1-growth)*4,0,2*Math.PI);
    ctx.strokeStyle="#fffae4";ctx.lineWidth=1;ctx.stroke();
  }
  ctx.restore();
}
function countLabel() {
  return contributions.length + (contributions.length===1 ? " neuron added" : " neurons added");
}
function renderCommunity(animate=false) {
  cancelAnimationFrame(growthFrame);
  const count=countLabel();
  byId("communityCount").textContent=count;
  byId("wideCount").textContent=count;
  byId("communityDiagram").setAttribute("aria-label","Lateral brain artwork with interconnected fibers. "+count+".");
  const start=performance.now();
  function draw(now){
    const progress=animate && !reduceMotion.matches ? Math.min(1,(now-start)/550) : 1;
    drawBrain(byId("communityDiagram"),false,progress);
    if(gallery.open)drawBrain(byId("wideBrain"),false,progress);
    if(progress<1)growthFrame=requestAnimationFrame(draw);
  }
  draw(start);
}
byId("contribute").onsubmit = event => {
  event.preventDefault();
  const point=newBranch(contributions.length);
  const parent=contributions.length ? contributions.reduce((nearest,item)=>
    distance(point,item.point)<distance(point,nearest.point) ? item : nearest).point : null;
  const entry={point,parent,theme:byId("theme").value,message:byId("message").value.trim().slice(0,100)};
  contributions.push(entry);
  if(entry.message){
    const tag=document.createElement("span");
    tag.style.setProperty("--theme-color",themeColors[entry.theme]);tag.textContent=entry.message;
    byId("messages").append(tag);
  }
  byId("message").value="";
  renderCommunity(true);
};
byId("clearBrain").onclick = () => {
  contributions.length=0;byId("contribute").reset();byId("messages").replaceChildren();renderCommunity();
};
function redrawZoom(){
  panX=Math.max(-288*(zoom-1),Math.min(panX,288*(zoom-1)));
  panY=Math.max(-210*(zoom-1),Math.min(panY,210*(zoom-1)));
  byId("zoomValue").textContent=Math.round(zoom*100)+"%";
  byId("wideBrain").style.cursor=zoom>1?"grab":"auto";
  drawBrain(byId("wideBrain"));
}
byId("expandBrain").onclick=()=>{
  zoom=1;panX=panY=0;byId("networkZoom").value=1;
  gallery.showModal();redrawZoom();
};
byId("closeBrain").onclick=()=>gallery.close();
gallery.addEventListener("close",()=>byId("expandBrain").focus({preventScroll:true}));
byId("networkZoom").oninput=()=>{zoom=Number(byId("networkZoom").value);redrawZoom();};
const enlarged=byId("wideBrain");
let drag=null;
enlarged.onpointerdown=e=>{
  if(zoom===1)return;
  drag={x:e.clientX,y:e.clientY,offsetX:panX,offsetY:panY};enlarged.setPointerCapture(e.pointerId);
};
enlarged.onpointermove=e=>{
  if(!drag)return;
  const rect=enlarged.getBoundingClientRect();
  panX=drag.offsetX+(e.clientX-drag.x)*576/rect.width;panY=drag.offsetY+(e.clientY-drag.y)*420/rect.height;redrawZoom();
};
enlarged.onlostpointercapture=()=>{drag=null;};
enlarged.onkeydown=e=>{
  const dirs={ArrowLeft:[24,0],ArrowRight:[-24,0],ArrowUp:[0,24],ArrowDown:[0,-24]};
  if(!dirs[e.key]||zoom===1)return;
  e.preventDefault();panX+=dirs[e.key][0];panY+=dirs[e.key][1];redrawZoom();
};
function updateBrainArt(){
  drawBrain(document.querySelector(".net-preview"),true);renderCommunity();
}
anatomy.onload=updateBrainArt;
anatomy.src="hero-brain.webp";
byId("contribute").reset();
updateBrainArt();

function drawWorksheet(canvas, labels) {
  const ctx = contextFor(canvas,580,265);
  const trunk = new Path2D("M149 134 Q197 126 250 139 Q320 153 405 128 Q420 124 441 123");
  const branches = [
    "M149 131 Q117 116 92 90 L59 69 M92 90 L87 60 L74 45 M116 110 L110 86",
    "M151 122 Q161 85 177 70 L196 57 M172 76 L168 48",
    "M143 134 Q99 129 72 136 L42 130 M72 136 L46 153",
    "M145 145 Q120 158 103 182 L73 199 M108 175 L113 207 M126 156 L96 161",
    "M145 127 Q129 92 132 65 L121 51 M132 65 L142 40",
    "M438 124 L467 98 L490 84 M467 98 L469 74",
    "M440 123 L479 128 L505 114 M479 128 L500 143",
    "M440 125 L460 151 L481 161 M460 151 L463 173"
  ].map(path => new Path2D(path));
  const soma = new Path2D("M127 125 Q146 100 161 115 Q169 129 185 132 Q173 140 161 153 Q146 169 130 151 Q124 142 127 125Z");
  for (const [color,outer] of [["#43364f",true],["#fff",false]]) {
    ctx.strokeStyle = color;ctx.fillStyle=color;ctx.lineWidth=outer?11:8;
    ctx.stroke(trunk);ctx.lineWidth=outer?8:5;
    branches.forEach(path => ctx.stroke(path));
    ctx.lineWidth=outer?5:1;
    ctx.stroke(soma);ctx.fill(soma);
  }
  ctx.beginPath();ctx.ellipse(147,135,8,9,0,0,2*Math.PI);ctx.strokeStyle="#51435e";ctx.lineWidth=1.6;ctx.stroke();
  for (const [x,y,angle] of [[220,135,.11],[265,141,.08],[312,142,-.05],[360,136,-.16]]) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.beginPath();ctx.roundRect(-14,-8,28,16,6);ctx.fillStyle="white";ctx.fill();ctx.strokeStyle="#51435e";ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
  }
  if (labels) {
    ctx.font="13px Arial";ctx.fillStyle="#31283b";
    const tags=[["Dendrites",36,25,64,33,82,58],["Cell body",145,240,167,222,151,158],["Axon & myelin",256,90,298,98,306,130],["Axon terminals",432,217,475,198,468,170]];
    tags.forEach(([text,x,y,x1,y1,x2,y2])=>{ctx.fillText(text,x,y);ctx.setLineDash([3,3]);line(ctx,x1,y1,x2,y2,"#7e7385",.9);ctx.setLineDash([]);});
  }
}
all(".craft-preview").forEach(canvas => drawWorksheet(canvas,false));
drawWorksheet(byId("printNeuron"),true);
byId("printBtn").onclick = () => window.print();
route(false);
