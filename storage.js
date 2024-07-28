console.log('storage.js loaded');

document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.local.get(['applications'], function (result) {
        let applications = result.applications;
        console.log('applications', applications);
        // also set the count
        if (applications && Array.isArray(applications)) {
            document.getElementById('count').innerText = applications.length;
        }

        if (applications && Array.isArray(applications)) {
            const table = document.getElementById('storageTable');
            applications.forEach((email) => {
                console.log('adding row');
                const row = table.insertRow();
                row.insertCell().innerText = email.gmail_id;
                row.insertCell().innerText = email.subject;
                row.insertCell().innerText = email.company_name;
                row.insertCell().innerText = email.company_slug;
                row.insertCell().innerText = email.job_link;
                row.insertCell().innerText = email.job_role;
                row.insertCell().innerText = email.stage_name;
            });
        }
    });
});
