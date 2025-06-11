document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // STATE & DATA MANAGEMENT
    // =================================================================
    const DB_NAME = 'versaPayDB';
    let appState = {
        currentOrgId: null,
        organizations: [],
        currentOrgData: null,
    };

    // Load initial data from localStorage
    function loadInitialData() {
        const db = JSON.parse(localStorage.getItem(DB_NAME));
        if (db && db.organizations) {
            appState.organizations = db.organizations;
        } else {
            // If no DB, initialize it
            localStorage.setItem(DB_NAME, JSON.stringify({ organizations: [] }));
        }
        
        // Check for a logged-in session
        const loggedInOrgId = localStorage.getItem('versaPaySession');
        if (loggedInOrgId) {
            login(loggedInOrgId, null, true); // Re-login from session
        }
    }

    function saveOrganizations() {
        localStorage.setItem(DB_NAME, JSON.stringify({ organizations: appState.organizations }));
    }

    function saveCurrentOrgData() {
        if (!appState.currentOrgId) return;
        const orgDataKey = `org_${appState.currentOrgId}`;
        localStorage.setItem(orgDataKey, JSON.stringify(appState.currentOrgData));
    }
    
    // =================================================================
    // AUTHENTICATION
    // =================================================================
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const orgName = document.getElementById('login-org-name').value;
        const password = document.getElementById('login-password').value;
        const org = appState.organizations.find(o => o.name.toLowerCase() === orgName.toLowerCase());

        if (org && org.password === password) {
            login(org.id);
        } else {
            document.getElementById('login-error').textContent = 'Invalid organization or password.';
        }
    });

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const orgName = document.getElementById('register-org-name').value;
        const password = document.getElementById('register-password').value;

        if (appState.organizations.some(o => o.name.toLowerCase() === orgName.toLowerCase())) {
            document.getElementById('register-error').textContent = 'Organization name already exists.';
            return;
        }

        const newOrg = {
            id: `org_${Date.now()}`,
            name: orgName,
            password: password, // In a real app, HASH this password!
        };

        appState.organizations.push(newOrg);
        saveOrganizations();

        // Create initial data structure for the new org
        const newOrgData = {
            employees: [],
            settings: {
                currency: 'USD',
                taxRate: 15, // Default 15%
                pensionRate: 5, // Default 5%
                allowances: [{ name: 'Housing', amount: 200 }, { name: 'Transport', amount: 100 }],
                deductions: [{ name: 'Union Dues', amount: 20 }]
            },
            payrollHistory: [],
        };
        const orgDataKey = `org_${newOrg.id}`;
        localStorage.setItem(orgDataKey, JSON.stringify(newOrgData));

        alert('Registration successful! Please log in.');
        registerForm.reset();
        document.getElementById('register-error').textContent = '';
    });

    function login(orgId, password = null, fromSession = false) {
        let org;
        if (fromSession) {
            org = appState.organizations.find(o => o.id === orgId);
        } else {
            org = appState.organizations.find(o => o.id === orgId);
        }

        if (org) {
            appState.currentOrgId = org.id;
            const orgDataKey = `org_${appState.currentOrgId}`;
            appState.currentOrgData = JSON.parse(localStorage.getItem(orgDataKey));
            
            localStorage.setItem('versaPaySession', org.id); // Create session

            document.getElementById('app-org-name').textContent = org.name;
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('app-screen').classList.add('active');
            navigateTo('dashboard-view');
        }
    }
    
    logoutBtn.addEventListener('click', () => {
        appState.currentOrgId = null;
        appState.currentOrgData = null;
        localStorage.removeItem('versaPaySession');
        
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
        loginForm.reset();
        document.getElementById('login-error').textContent = '';
    });

    // =================================================================
    // NAVIGATION & UI RENDERING
    // =================================================================
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            navigateTo(viewId);
        });
    });

    function navigateTo(viewId) {
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-view') === viewId);
        });
        
        // Render content for the selected view
        switch (viewId) {
            case 'dashboard-view': renderDashboard(); break;
            case 'employees-view': renderEmployees(); break;
            case 'settings-view': renderSettings(); break;
            case 'payroll-view': renderPayroll(); break;
            case 'reports-view': renderReports(); break;
        }
    }

    function renderDashboard() {
        const view = document.getElementById('dashboard-view');
        const { employees, payrollHistory } = appState.currentOrgData;
        const lastPayroll = payrollHistory.length > 0 ? payrollHistory[payrollHistory.length - 1] : null;
        const totalPayrollCost = lastPayroll ? lastPayroll.records.reduce((sum, r) => sum + r.grossSalary, 0) : 0;
        const currency = appState.currentOrgData.settings.currency;

        view.innerHTML = `
            <h2>Dashboard</h2>
            <div class="dashboard-grid">
                <div class="card stat-card">
                    <div class="value">${employees.length}</div>
                    <div class="label">Total Employees</div>
                </div>
                <div class="card stat-card">
                    <div class="value">${currency} ${totalPayrollCost.toFixed(2)}</div>
                    <div class="label">Last Payroll Cost</div>
                </div>
                <div class="card stat-card">
                    <div class="value">${lastPayroll ? new Date(lastPayroll.date).toLocaleDateString() : 'N/A'}</div>
                    <div class="label">Last Payroll Run</div>
                </div>
            </div>
        `;
    }

    function renderEmployees() {
        const view = document.getElementById('employees-view');
        const { employees } = appState.currentOrgData;
        
        let tableRows = employees.map(emp => `
            <tr>
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td>${emp.role}</td>
                <td>${appState.currentOrgData.settings.currency} ${emp.basicSalary.toFixed(2)}</td>
                <td class="actions">
                    <button class="btn-edit" onclick="showEmployeeForm('${emp.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteEmployee('${emp.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

        view.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2>Employee Management</h2>
                    <button onclick="showEmployeeForm()">+ Add Employee</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Basic Salary</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows || '<tr><td colspan="5">No employees found.</td></tr>'}</tbody>
                </table>
            </div>
        `;
    }

    function renderSettings() {
        const view = document.getElementById('settings-view');
        const { settings } = appState.currentOrgData;

        view.innerHTML = `
            <h2>Organization Settings</h2>
            <form id="settings-form" class="card">
                <h3>General</h3>
                <label for="currency">Currency Symbol</label>
                <input type="text" id="currency" value="${settings.currency}" required>
                
                <h3>Standard Deductions</h3>
                <label for="taxRate">Tax Rate (%)</label>
                <input type="number" id="taxRate" step="0.1" value="${settings.taxRate}" required>
                
                <label for="pensionRate">Pension Rate (%)</label>
                <input type="number" id="pensionRate" step="0.1" value="${settings.pensionRate}" required>
                
                <!-- We can add dynamic allowances/deductions here in a future version -->

                <button type="submit">Save Settings</button>
            </form>
        `;

        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            appState.currentOrgData.settings.currency = document.getElementById('currency').value;
            appState.currentOrgData.settings.taxRate = parseFloat(document.getElementById('taxRate').value);
            appState.currentOrgData.settings.pensionRate = parseFloat(document.getElementById('pensionRate').value);
            saveCurrentOrgData();
            alert('Settings saved!');
            navigateTo('dashboard-view');
        });
    }

    function renderPayroll() {
        const view = document.getElementById('payroll-view');
        const { payrollHistory } = appState.currentOrgData;
        const lastPayroll = payrollHistory.length > 0 ? payrollHistory[payrollHistory.length - 1] : null;

        view.innerHTML = `
            <div class="card">
                <h2>Run Payroll</h2>
                <p>This will calculate salaries, deductions, and net pay for all employees for the current period.</p>
                <p>Last payroll was run on: <strong>${lastPayroll ? new Date(lastPayroll.date).toLocaleDateString() : 'Never'}</strong></p>
                <form id="run-payroll-form">
                    <label for="payroll-month">Payroll Period (Month/Year):</label>
                    <input type="month" id="payroll-month" required value="${new Date().toISOString().slice(0, 7)}">
                    <button type="submit">Run Payroll</button>
                </form>
            </div>
        `;
        
        document.getElementById('run-payroll-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const period = document.getElementById('payroll-month').value;
            if (confirm(`Are you sure you want to run payroll for ${period}? This cannot be undone.`)) {
                runPayroll(period);
            }
        });
    }
    
    function renderReports() {
        const view = document.getElementById('reports-view');
        const { payrollHistory, settings } = appState.currentOrgData;

        let historyHtml = payrollHistory.slice().reverse().map(run => `
            <div class="card">
                <h3>Payroll for ${new Date(run.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</h3>
                <p>Total Cost: ${settings.currency} ${run.totalCost.toFixed(2)} | Employees: ${run.records.length}</p>
                <table>
                    <thead>
                        <tr><th>Employee</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                    ${run.records.map(r => `
                        <tr>
                            <td>${r.employeeName} (${r.employeeId})</td>
                            <td>${settings.currency} ${r.grossSalary.toFixed(2)}</td>
                            <td>${settings.currency} ${r.totalDeductions.toFixed(2)}</td>
                            <td><strong>${settings.currency} ${r.netSalary.toFixed(2)}</strong></td>
                            <td><button onclick="showPayslip('${run.id}', '${r.employeeId}')">View Payslip</button></td>
                        </tr>
                    `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');

        view.innerHTML = `
            <h2>Payroll History & Reports</h2>
            ${payrollHistory.length > 0 ? historyHtml : '<p>No payroll history found.</p>'}
        `;
    }

    // =================================================================
    // MODAL & FORM HANDLING
    // =================================================================
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');

    function showModal(content) {
        modalContent.innerHTML = content;
        modalContainer.classList.remove('hidden');
    }

    function hideModal() {
        modalContainer.classList.add('hidden');
        modalContent.innerHTML = '';
    }
    
    // Use event delegation for closing the modal
    modalContainer.addEventListener('click', (e) => {
        if (e.target.id === 'modal-container' || e.target.id === 'close-modal-btn') {
            hideModal();
        }
    });

    // Make functions globally accessible for inline onclick handlers
    window.showEmployeeForm = (employeeId = null) => {
        const isEditing = employeeId !== null;
        const emp = isEditing ? appState.currentOrgData.employees.find(e => e.id === employeeId) : {};
        
        const formHtml = `
            <div class="modal-header">
                <h2>${isEditing ? 'Edit' : 'Add'} Employee</h2>
                <button id="close-modal-btn">×</button>
            </div>
            <form id="employee-form">
                <input type="hidden" id="employeeId" value="${emp.id || ''}">
                <label for="employeeName">Full Name</label>
                <input type="text" id="employeeName" value="${emp.name || ''}" required>
                
                <label for="employeeRole">Role / Position</label>
                <input type="text" id="employeeRole" value="${emp.role || ''}" required>
                
                <label for="basicSalary">Basic Salary</label>
                <input type="number" id="basicSalary" step="0.01" value="${emp.basicSalary || ''}" required>
                
                <button type="submit">${isEditing ? 'Update' : 'Add'} Employee</button>
            </form>
        `;
        showModal(formHtml);

        document.getElementById('employee-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const employeeData = {
                id: document.getElementById('employeeId').value,
                name: document.getElementById('employeeName').value,
                role: document.getElementById('employeeRole').value,
                basicSalary: parseFloat(document.getElementById('basicSalary').value),
            };
            
            if (isEditing) {
                const index = appState.currentOrgData.employees.findIndex(e => e.id === employeeData.id);
                appState.currentOrgData.employees[index] = employeeData;
            } else {
                employeeData.id = `emp_${Date.now()}`;
                appState.currentOrgData.employees.push(employeeData);
            }
            
            saveCurrentOrgData();
            hideModal();
            renderEmployees();
        });
    };

    window.deleteEmployee = (employeeId) => {
        if (confirm('Are you sure you want to delete this employee?')) {
            appState.currentOrgData.employees = appState.currentOrgData.employees.filter(e => e.id !== employeeId);
            saveCurrentOrgData();
            renderEmployees();
        }
    };
    
    window.showPayslip = (runId, employeeId) => {
        const run = appState.currentOrgData.payrollHistory.find(r => r.id === runId);
        const record = run.records.find(r => r.employeeId === employeeId);
        const { settings } = appState.currentOrgData;

        const payslipHtml = `
            <div class="modal-header">
                <h2>Payslip</h2>
                <button id="close-modal-btn">×</button>
            </div>
            <div class="payslip" id="payslip-to-print">
                <div class="payslip-header">
                    <h3>${appState.organizations.find(o => o.id === appState.currentOrgId).name}</h3>
                    <p>Payslip for ${new Date(run.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
                </div>
                <div class="payslip-grid">
                    <div><strong>Employee Name:</strong> ${record.employeeName}</div>
                    <div><strong>Employee ID:</strong> ${record.employeeId}</div>
                    <div><strong>Role:</strong> ${record.employeeRole}</div>
                    <div><strong>Payment Date:</strong> ${new Date(run.date).toLocaleDateString()}</div>
                </div>
                <div class="payslip-section payslip-grid">
                    <div style="grid-column: 1 / -1;"><strong>Earnings</strong></div>
                    <div>Basic Salary:</div><div style="text-align: right;">${settings.currency} ${record.basicSalary.toFixed(2)}</div>
                    <div>Allowances:</div><div style="text-align: right;">${settings.currency} ${record.allowances.toFixed(2)}</div>
                    <div class="payslip-total">Gross Salary:</div><div class="payslip-total" style="text-align: right;">${settings.currency} ${record.grossSalary.toFixed(2)}</div>
                </div>
                <div class="payslip-section payslip-grid">
                    <div style="grid-column: 1 / -1;"><strong>Deductions</strong></div>
                    <div>Tax (${settings.taxRate}%):</div><div style="text-align: right;">${settings.currency} ${record.tax.toFixed(2)}</div>
                    <div>Pension (${settings.pensionRate}%):</div><div style="text-align: right;">${settings.currency} ${record.pension.toFixed(2)}</div>
                    <div>Other Deductions:</div><div style="text-align: right;">${settings.currency} ${record.otherDeductions.toFixed(2)}</div>
                    <div class="payslip-total">Total Deductions:</div><div class="payslip-total" style="text-align: right;">${settings.currency} ${record.totalDeductions.toFixed(2)}</div>
                </div>
                <div class="payslip-section payslip-grid" style="font-size: 1.2em;">
                    <strong class="payslip-total">Net Salary:</strong>
                    <strong class="payslip-total" style="text-align: right;">${settings.currency} ${record.netSalary.toFixed(2)}</strong>
                </div>
            </div>
            <button onclick="window.print()" style="margin-top: 20px;">Print Payslip</button>
        `;
        showModal(payslipHtml);
    };

    // =================================================================
    // CORE PAYROLL LOGIC
    // =================================================================
    function runPayroll(period) {
        const { employees, settings } = appState.currentOrgData;
        if (employees.length === 0) {
            alert('Cannot run payroll. No employees found.');
            return;
        }

        const payrollRun = {
            id: `pay_${Date.now()}`,
            date: new Date(`${period}-01`), // Use the first of the month for consistency
            records: [],
            totalCost: 0,
        };

        employees.forEach(emp => {
            const allowances = settings.allowances.reduce((sum, a) => sum + a.amount, 0);
            const otherDeductions = settings.deductions.reduce((sum, d) => sum + d.amount, 0);

            const grossSalary = emp.basicSalary + allowances;
            const tax = (grossSalary * settings.taxRate) / 100;
            const pension = (grossSalary * settings.pensionRate) / 100;
            const totalDeductions = tax + pension + otherDeductions;
            const netSalary = grossSalary - totalDeductions;

            payrollRun.records.push({
                employeeId: emp.id,
                employeeName: emp.name,
                employeeRole: emp.role,
                basicSalary: emp.basicSalary,
                allowances: allowances,
                grossSalary: grossSalary,
                tax: tax,
                pension: pension,
                otherDeductions: otherDeductions,
                totalDeductions: totalDeductions,
                netSalary: netSalary,
            });
        });

        payrollRun.totalCost = payrollRun.records.reduce((sum, r) => sum + r.grossSalary, 0);
        appState.currentOrgData.payrollHistory.push(payrollRun);
        saveCurrentOrgData();
        
        alert(`Payroll for ${period} completed successfully!`);
        navigateTo('reports-view');
    }

    // =================================================================
    // INITIALIZE APP
    // =================================================================
    loadInitialData();
});