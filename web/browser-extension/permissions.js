const access = document.querySelector("#access");
const button = document.querySelector("#grant");
const status = document.querySelector("#status");

async function update() {
  const { requestedOrigins = [] } = await chrome.storage.local.get("requestedOrigins");
  const origins = requestedOrigins.filter((origin) => /^https:\/\/[a-z0-9.-]+\/\*$/.test(origin));
  access.textContent = origins.length ? "Allow access to: " + origins.map((value) => new URL(value).hostname).join(", ") :
    "No additional provider access requested. Return to K45movies.";
  button.hidden = !origins.length;
  button.onclick = async () => {
    try {
      const granted = await chrome.permissions.request({ origins });
      if (granted) await chrome.storage.local.remove("requestedOrigins");
      status.textContent = granted ? "Access granted. Retry the request on K45movies." : "Access was declined.";
      await update();
    } catch {
      status.textContent = "Could not update provider access.";
    }
  };
}

void update();
