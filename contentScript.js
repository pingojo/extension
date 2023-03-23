console.log("contentScript.js is loaded");
const observer = new MutationObserver(handleDomChanges);
const observerConfig = {
  childList: true,
  subtree: true
};
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

function getCookieValue(cookieString, cookieName) {
  const cookiePairs = cookieString.split('; ');
  for (let i = 0; i < cookiePairs.length; i++) {
    const pair = cookiePairs[i].split('=');
    if (pair[0] === cookieName) {
      return pair[1];
    }
  }
  return null;
}

function createDropdownMenu(nameEmail, domain, companyName, datetime, emailId) {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown-menu');
  dropdown.style.cssText = 'position: absolute; display: none; background-color: white; border: 1px solid #ddd; z-index: 1000; padding: 8px;';

  const sendDataToDRF = (stage) => {
    console.log('send data to drf')
    const payload = {
      company_name: companyName,
      stage: stage,
      source_domain: domain,
      source_email: nameEmail.email,
      source_name: nameEmail.name,
      date_time: datetime,
      email_id: emailId
    };
    console.log('payload', payload)
    //var base_url = 'http://127.0.0.1:8000';
    var base_url = 'https://www.pingojo.com';
    var full_url = base_url +"/api/application/";

    chrome.runtime.sendMessage({
      type: 'getSessionCookie',
      url: base_url
    }, (sessionCookie) => {
      console.log('sessionCookie', sessionCookie)
      if (sessionCookie) {

        chrome.runtime.sendMessage({
          type: 'getCSRFToken',
          url: base_url
        }, (csrfToken) => {
          console.log('CSRF token', csrfToken);
          if (csrfToken) {
            console.log('CSRF token', csrfToken);

            headers = {
              'Content-Type': 'application/json',
              'Cookie': `sessionid=${sessionCookie.value}`,
              'X-CSRFToken': csrfToken,
            }
            console.log('headers', headers)

            fetch(full_url, {
                method: 'POST',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify(payload)
              })
              .then(response => {
                if (!response.ok) {
                  throw new Error('Network response was not ok');
                }
                return response.json();
              })
              .then(data => {
                console.log(data);
              })
              .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
              });

          } else {
            console.error('Session cookie not found');
            window.location=base_url+'/accounts/login/?from=gmail';
          }
        });
      } else {
        console.error('Session cookie not found');
        window.location=base_url+'/accounts/login/?from=gmail';
      }
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
    chrome.runtime.sendMessage({
      type: 'addContact',
      contact: nameEmail
    }, (response) => {
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
  console.log("emailHeader", emailHeader);
  const nameEmail = extractSenderInfo(emailHeader);
  const subjectInfo = extractSubjectInfo(emailHeader);
  const domain = parseDomain(nameEmail.email);
  const datetime = extractDatetime(emailHeader);
  const { email: emailId } = extractSenderInfo(emailHeader);

  console.log("subject", subjectInfo.subject);

  const subjectTemplates = [
    /(.*) Application Update/,
    /Thank you for your interest with (.*)/,
    /Your job application with (.*)/,
    /Thanks for your interest in (.*), .*/,
    /Important information about your application to (.*)/,
    /Your application to (.*) was accepted!/,
    /Thank you for your interest in (.*)/,
    /Application to (.*) successfully submitted/
  ];

  let companyName = "";
  let matchTemplate = false;

  for (const template of subjectTemplates) {
    const match = subjectInfo.subject.match(template);
    if (match) {
      companyName = match[1];
      matchTemplate = true;
      break;
    }
  }

  if (domain) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;

    const img = document.createElement("img");
    img.src = faviconUrl;
    img.style.cssText = "width: 20px; height: 20px; cursor: pointer;";
    img.classList.add("crm-icon");

    if (matchTemplate) {
      img.style.border = "2px solid green";
    }

    img.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown(dropdown);
    });

    const td = document.createElement("td");
    td.style.verticalAlign = "middle";
    td.appendChild(img);
    const dropdown = createDropdownMenu(nameEmail, domain, companyName, datetime, emailId);
    td.appendChild(dropdown);

    const firstCell = emailHeader.querySelector("td");
    if (firstCell) {
      emailHeader.insertBefore(td, firstCell);
    }
  }

  console.log("Company Name:", companyName);
  console.log("Datetime:", datetime);
}

function extractDatetime(emailHeader) {
  const datetimeElement = emailHeader.querySelector("td.xY span[title]");
  if (!datetimeElement) return '';

  const datetime = datetimeElement.getAttribute("title");
  const cleanedDatetime = datetime.replace(/\u202F/g, ' ');
  return cleanedDatetime;
}




function extractSubjectInfo(emailHeader) {
  const subjectElement = emailHeader.querySelector('.xT .y6 span');
  if (!subjectElement) return { subject: '' };

  const subject = subjectElement.textContent;
  return { subject };
}


function extractSenderInfo(emailHeader) {
  const senderDetails = emailHeader.querySelector('.yW span[email]');
  if (!senderDetails) return {
    name: '',
    email: ''
  };

  const email = senderDetails.getAttribute('email');
  const name = senderDetails.textContent;

  return {
    name,
    email
  };
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
