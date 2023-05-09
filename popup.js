document.addEventListener("DOMContentLoaded", () => {
  const urlForm = document.getElementById("urlForm");
  const baseURL = document.getElementById("baseURL");
  const currentBaseURL = document.getElementById("currentBaseURL");

  chrome.storage.sync.get("base_url", ({ base_url }) => {
    baseURL.value = base_url || "";
    currentBaseURL.textContent = base_url || "Not set";
  });

  urlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    chrome.storage.sync.set({ base_url: baseURL.value });

    currentBaseURL.textContent = baseURL.value;
  });
});


document.addEventListener("DOMContentLoaded", function () {
  const clearDataButton = document.getElementById("clear-data-btn");

  clearDataButton.addEventListener("click", function () {
      chrome.storage.sync.remove("applications", function () {
          console.log("Data cleared from storage.");
      });
  });
});