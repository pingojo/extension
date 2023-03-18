const observer = new MutationObserver(handleDomChanges);
const observerConfig = { childList: true, subtree: true };
const targetNode = document.querySelector('body');
observer.observe(targetNode, observerConfig);

function handleDomChanges() {
  const emailHeaders = document.querySelectorAll('table.F.cf.zt tr[role="row"]');
  emailHeaders.forEach((header) => {
    if (!header.querySelector('.crm-button')) {
      addCrmButton(header);
    }
  });
}

function addCrmButton(emailHeader) {
    const button = document.createElement('button');
    button.classList.add('crm-button');
    button.textContent = 'Add to CRM';
    button.style.backgroundColor = '#4285f4';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.padding = '4px 8px';
    button.style.fontSize = '14px';
    button.style.cursor = 'pointer';
  
    const nameEmail = extractSenderInfo(emailHeader);
    button.addEventListener('click', (event) => {
        // Prevent the click event from propagating to the parent elements
        event.stopPropagation();
      
        chrome.runtime.sendMessage(
          { type: 'addContact', contact: nameEmail },
          (response) => {
            if (response.success) {
              button.textContent = 'Added';
              button.disabled = true;
            }
          }
        );
      });
      
  
    const td = document.createElement('td');
    td.style.verticalAlign = 'middle';
    td.appendChild(button);
  
    const subjectCell = emailHeader.querySelector('td.xY');
    if (subjectCell) {
      emailHeader.insertBefore(td, subjectCell.nextSibling);
    }
  }
  

function extractSenderInfo(emailHeader) {
  const senderDetails = emailHeader.querySelector('td.yX > span[email]');
  if (!senderDetails) return { name: '', email: '' };

  const email = senderDetails.getAttribute('email');
  const name = senderDetails.textContent;

  return { name, email };
}
