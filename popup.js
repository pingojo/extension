document.getElementById("copy-and-open").addEventListener("click", function() {
  console.log("Button clicked");

  // Get the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const activeTab = tabs[0];
      console.log("Active tab retrieved:", activeTab);

      // Send a message to the content script to get the selected text of the current page
      chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: getSelectedText
      }, (results) => {
          console.log("Results from getSelectedText:", results);

          if (results && results[0] && results[0].result) {
              let selectedText = results[0].result;
              console.log("Selected text retrieved:", selectedText);

              // Get the prompt_text from chrome.storage.sync
              chrome.storage.sync.get("prompt_text", function(data) {
                  console.log("Data from chrome.storage.sync:", data);

                  let combinedText = (data.prompt_text || '');  // Start with prompt_text
                  console.log("Combined text before checking clipboard:", combinedText);

                  // Check clipboard for email address
                  navigator.clipboard.readText().then(function(clipboardText) {
                      console.log("Clipboard text retrieved:", clipboardText);

                      // Regular expression to detect email addresses
                      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
                      const emailMatch = clipboardText.match(emailRegex);

                      if (emailMatch) {
                          console.log("Email found in clipboard:", emailMatch[0]);
                          combinedText += emailMatch[0] + "\n";
                      } else {
                          console.log("No email found in clipboard.");
                      }

                      // Append the selected text at the end (with a space or no newline)
                      combinedText += selectedText;

                      console.log("Final combined text:", combinedText);

                      // Copy the combined text to the clipboard
                      navigator.clipboard.writeText(combinedText).then(function() {
                          console.log("Text successfully copied to clipboard");

                          // Open ChatGPT
                          chrome.tabs.create({ url: "https://chat.openai.com/?temporary-chat=true&model=gpt-4o-mini" });
                          console.log("ChatGPT tab opened");
                      }, function() {
                          console.error("Failed to copy text to clipboard.");
                      });
                  }).catch(function(error) {
                      console.error("Failed to read clipboard:", error);
                  });
              });
          } else {
              console.error("Failed to retrieve selected text.");
          }
      });
  });
});

// This function retrieves only the selected text from the page
function getSelectedText() {
  const selection = window.getSelection();
  if (selection) {
      return selection.toString();
  } else {
      return '';
  }
}





function getTextFromPage() {
  console.log("Executing getTextFromPage function");
  function getTextFromElement(element) {
    let text = '';
    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += getTextFromElement(child);
      }
    });
    return text.trim();
  }
  // Extracting text from the entire document body
  let bodyText = getTextFromElement(document.body);

  console.log("Body text extracted:", bodyText);
  return bodyText;
}


document.addEventListener("DOMContentLoaded", () => {

  



  const clearDataButton = document.getElementById("clear-data-btn");

  if (clearDataButton) {
    clearDataButton.addEventListener("click", function () {
      alert("Data will be cleared from storage.");
      chrome.runtime.sendMessage({ type: "clearApplications" }, function (response) {
        if (response.success) {
          alert("Cleared Data.");
        } else {
          alert("Failed to clear data.");
        }
      });
    });
  } else {
    console.error("Element with ID 'clear-data-btn' not found.");
  }

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


});



document.getElementById('start-job').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: startJobCapture
      });
  });
});

function startJobCapture() {
  alert('Starting job capture! Follow the prompts on the page.');
  // Initialize the job capture by calling functions in the content script.
  window.postMessage({ action: 'start-job-capture' }, '*');
}


document.getElementById('submit-email').addEventListener('click', () => {
  const company_email = document.getElementById('company_email').value;
  chrome.runtime.sendMessage({ action: 'submit-job', company_email });
});