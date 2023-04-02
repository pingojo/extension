chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'addContact') {
    addContact(message.contact);
    sendResponse({
      success: true
    });
  }
});


document.getElementById('contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('contact-name').value;
  const email = document.getElementById('contact-email').value;
  addContact({
    name,
    email
  });
  e.target.reset();
});

function addContact(contact) {
  const contacts = JSON.parse(localStorage.getItem('contacts')) || [];
  contacts.push(contact);
  localStorage.setItem('contacts', JSON.stringify(contacts));
  displayContacts();
}

function displayContacts() {
  const contacts = JSON.parse(localStorage.getItem('contacts')) || [];
  const contactList = document.getElementById('contact-list');
  contactList.innerHTML = '';

  contacts.forEach((contact) => {
    const listItem = document.createElement('li');
    listItem.textContent = `${contact.name} (${contact.email})`;
    contactList.appendChild(listItem);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const urlForm = document.getElementById("urlForm");
  const baseURL = document.getElementById("baseURL");
  const currentBaseURL = document.getElementById("currentBaseURL");

  // Load the current base_url from chrome.storage.sync
  chrome.storage.sync.get("base_url", ({ base_url }) => {
    baseURL.value = base_url || "";
    currentBaseURL.textContent = base_url || "Not set";
  });

  urlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    // Save the updated base_url to chrome.storage.sync
    chrome.storage.sync.set({ base_url: baseURL.value });

    // Update the displayed current base_url
    currentBaseURL.textContent = baseURL.value;
  });
});


displayContacts();

document.addEventListener("DOMContentLoaded", function () {
  const clearDataButton = document.getElementById("clear-data-btn");

  clearDataButton.addEventListener("click", function () {
      chrome.storage.sync.remove("applications", function () {
          console.log("Data cleared from storage.");
      });
  });
});