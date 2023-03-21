const observer = new MutationObserver(handleDomChanges);
const observerConfig = { childList: true, subtree: true };
const targetNode = document.querySelector('body');
observer.observe(targetNode, observerConfig);

function handleDomChanges() {
  const emailHeaders = document.querySelectorAll('.zA');
  emailHeaders.forEach((header) => {
    if (!header.querySelector('.crm-icon')) {
      addCrmIcon(header);
    }
  });
}

function createDropdownMenu(nameEmail) {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown-menu');
  dropdown.style.cssText = 'position: absolute; display: none; background-color: white; border: 1px solid #ddd; z-index: 1000; padding: 8px;';

  const sendDataToDRF = (stage) => {
    console.log('send data to drf')
    const payload = {
      company_name: nameEmail.name,
      stage,
    };
  
    fetch('https://www.pingojo.com/api/comingsoon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Success:', data);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };
  
  const addItem = (text, callback) => {
    const item = document.createElement('div');
    item.style.cssText = 'cursor: pointer; padding: 4px 8px;';
    item.textContent = text;
  
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      callback();
      toggleDropdown(dropdown);
    });
  
    dropdown.appendChild(item);
  };
  
  addItem('Add Contact', () => {
    chrome.runtime.sendMessage({ type: 'addContact', contact: nameEmail }, (response) => {
      if (response.success) {
        alert('Contact added');
      }
    });
  });
  
  addItem('Applied', () => sendDataToDRF('Applied'));
  addItem('Next', () => sendDataToDRF('Next'));
  addItem('Scheduled', () => sendDataToDRF('Scheduled'));
  addItem('Passed', () => sendDataToDRF('Passed'));
  

  return dropdown;
}

function toggleDropdown(dropdown) {
  if (dropdown.style.display === 'none') {
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
}

function addCrmIcon(emailHeader) {
  const nameEmail = extractSenderInfo(emailHeader);
  const domain = parseDomain(nameEmail.email);

  if (domain) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;

    const img = document.createElement('img');
    img.src = faviconUrl;
    img.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
    img.classList.add('crm-icon');

    img.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDropdown(dropdown);
    });

    const td = document.createElement('td');
    td.style.verticalAlign = 'middle';
    td.appendChild(img);
    const dropdown = createDropdownMenu(nameEmail);
    td.appendChild(dropdown);

    const subjectCell = emailHeader.querySelector('.xY');
    if (subjectCell) {
      emailHeader.insertBefore(td, subjectCell);
    }
  }
}

function extractSenderInfo(emailHeader) {
  const senderDetails = emailHeader.querySelector('.yW span[email]');
  if (!senderDetails) return { name: '', email: '' };

  const email = senderDetails.getAttribute('email');
  const name = senderDetails.textContent;

  return { name, email };
}

function parseDomain(email) {
  const domain = email.substring(email.lastIndexOf('@') + 1);
  const parts = domain.split('.');
  if (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
}

document.addEventListener('click', () => {
  const dropdowns = document.querySelectorAll('.dropdown-menu');
  dropdowns.forEach((dropdown) => {
    dropdown.style.display = 'none';
  });
});
