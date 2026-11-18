var cmInitContent = "font: italic 1.5em cursive;\n\n";

(function checkFeatureSupport() {
  var featureStatus = document.getElementById("feature-status");
  var supportsFont =
    window.CSS &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("font", "italic 1.5em cursive");

  if (!supportsFont) {
    document.documentElement.classList.add("no-font-support");
    if (featureStatus) {
      featureStatus.hidden = false;
      featureStatus.textContent =
        "Your browser does not support the CSS font shorthand syntax demonstrated in this example. Fallback serif styling is used.";
    }
  }
})();
