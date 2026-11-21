var element = document.getElementById("example-element");
var originalChoices = [];
var initialChoice = 0;

function applyCode(code, choice) {
  element.style.cssText = code;
  var errorIcon = choice.querySelector(".error");
  if (!element.style.cssText) {
    errorIcon.classList.remove("hidden");
  } else {
    errorIcon.classList.add("hidden");
  }
}

var exampleChoices = document.querySelectorAll(".example-choice");

function indexOf(exampleChoices, choice) {
  for (var i = 0; i < exampleChoices.length; i++) {
    if (exampleChoices[i] === choice) {
      return i;
    }
  }
  return -1;
}

function choose(choice) {
  choice.classList.add("selected");
  choice.firstChild.setAttribute("contentEditable", true);
  choice.firstChild.setAttribute("spellcheck", false);
  choice.firstChild.focus();
  applyCode(choice.textContent, choice);
}

function onChoose(e) {
  // highlght the code we are leaving
  var selected = document.querySelector(".selected");
  if (selected && e.currentTarget != selected) {
    var highlighted = Prism.highlight(
      selected.firstChild.textContent,
      Prism.languages.css,
    );
    selected.firstChild.innerHTML = highlighted;
  }
  if (selected) {
    var errorIcon = selected.querySelector(".error");
    if (errorIcon) {
      errorIcon.classList.add("hidden");
    }
  }
  for (exampleChoice of exampleChoices) {
    exampleChoice.classList.remove("selected");
  }
  choose(e.currentTarget);
}

function onEdit(e) {
  applyCode(e.currentTarget.textContent, e.currentTarget.parentNode);
}

function copyTextOnly(e) {
  var selection = window.getSelection();
  var range = selection.getRangeAt(0);

  e.clipboardData.setData("text/plain", range.toString());
  e.clipboardData.setData("text/html", range.toString());
  e.preventDefault();
  e.stopPropagation();
}

document.addEventListener("cut", copyTextOnly);
document.addEventListener("copy", copyTextOnly);

// Ensure keyboard focus visibility without modifying static CSS files
if (!document.getElementById("editable-keyboard-focus-style")) {
  var focusStyle = document.createElement("style");
  focusStyle.id = "editable-keyboard-focus-style";
  focusStyle.textContent =
    ".example-choice:focus-visible { outline: 2px solid #005a9c; outline-offset: 2px; } " +
    ".reset:focus-visible { outline: 2px solid #005a9c; } " +
    "[contenteditable]:focus-visible { outline: 2px solid #005a9c !important; }";
  document.head.appendChild(focusStyle);
}

for (exampleChoice of exampleChoices) {
  originalChoices.push(exampleChoice.textContent);
  if (exampleChoice.getAttribute("initial-choice")) {
    initialChoice = indexOf(exampleChoices, exampleChoice);
  }
  exampleChoice.setAttribute("tabindex", "0");
  exampleChoice.setAttribute("role", "button");
  exampleChoice.addEventListener("click", onChoose);
  exampleChoice.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onChoose({ currentTarget: e.currentTarget });
      }
    }
  });
  exampleChoice.firstChild.addEventListener("keyup", onEdit);
  exampleChoice.querySelector(".reset").addEventListener("click", function (e) {
    var choice = e.target.parentNode;
    var replacementText = originalChoices[indexOf(exampleChoices, choice)];
    var highlighted = Prism.highlight(replacementText, Prism.languages.css);
    choice.firstChild.innerHTML = highlighted;
  });
}

choose(exampleChoices[initialChoice]);
