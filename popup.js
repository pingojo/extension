chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'addContact') {
      addContact(message.contact);
      sendResponse({ success: true });
    }
  });

  
document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    addContact({ name, email });
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
  
  displayContacts();
  