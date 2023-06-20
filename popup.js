document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("[data-form-key]");
  const displayElements = document.querySelectorAll("[data-display-key]");

  const processForm = (form, input, current, storageKey) => {
    chrome.storage.sync.get(storageKey, (data) => {
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
    const current = Array.from(displayElements).find(
      el => el.dataset.displayKey === storageKey
    );

    processForm(form, input, current, storageKey);
  });

  const clearDataButton = document.getElementById("clear-data-btn");

  clearDataButton.addEventListener("click", function () {
    chrome.storage.sync.remove("applications", function () {
      console.log("Data cleared from storage.");
    });
  });
});
