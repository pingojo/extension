document.addEventListener("DOMContentLoaded", () => {

  document.getElementById('view-storage-btn').addEventListener('click', function () {
    chrome.tabs.create({ url: 'storage.html' });
  });

  const forms = document.querySelectorAll("[data-form-key]");
  const displayElements = document.querySelectorAll("[data-display-key]");

  const processForm = (form, input, current, storageKey) => {
    // If storageKey is null or undefined, return immediately
    if (!storageKey) {
      console.warn('storageKey is null or undefined');
      return;
    }

    chrome.storage.sync.get(storageKey, (data) => {
      //check if input is not null 
      if (!input) {
        return;
      }
      input.value = data[storageKey] || "";
      current.textContent = data[storageKey] || "Not set";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      chrome.storage.sync.set({ [storageKey]: input.value });

      current.textContent = input.value;
    });
  };

  forms.forEach(form => {
    const input = form.querySelector('input');
    const storageKey = form.dataset.formKey;

    // Skip this iteration if storageKey is null or undefined
    if (!storageKey) {
      return;
    }

    const current = Array.from(displayElements).find(
      el => el.dataset.displayKey === storageKey
    );

    processForm(form, input, current, storageKey);
  });

  const clearDataButton = document.getElementById("clear-data-btn");

  clearDataButton.addEventListener("click", function () {
    alert("Data will be cleared from storage.");
    chrome.storage.sync.remove("applications", function () {
      console.log("Data cleared from storage.");
    });
  });
});
