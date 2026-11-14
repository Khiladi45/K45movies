const access = document.querySelector("#access");
const button = document.querySelector("#grant");
const status = document.querySelector("#status");
const origins = ["https://*/*"];

async function update() {
  const granted = await chrome.permissions.contains({ origins });
  access.textContent = granted
    ? "Provider access is enabled. Return to K45movies and retry."
    : "Allow the bridge to connect to HTTPS provider and media sites with one browser approval.";
  button.hidden = granted;
}

button.onclick = async () => {
  try {
    const granted = await chrome.permissions.request({ origins });
    status.textContent = granted ? "Access granted." : "Access was declined.";
    await update();
  } catch {
    status.textContent = "Could not update provider access.";
  }
};

void update();
