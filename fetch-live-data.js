const axios = require('axios');

async function fetchLive() {
  try {
    // 1. Login to live API
    console.log("Logging into Live API...");
    let loginRes;
    try {
      loginRes = await axios.post('https://payroll-new-southpointbackend-production.up.railway.app/api/auth/admin/login', {
        email: 'superadmin@gmail.com',
        password: '123456'
      });
    } catch(err) {
      console.log("Password 123456 failed, trying Admin@123...");
      loginRes = await axios.post('https://payroll-new-southpointbackend-production.up.railway.app/api/auth/admin/login', {
        email: 'superadmin@gmail.com',
        password: 'Admin@123'
      });
    }
    
    const token = loginRes.data.data.accessToken;
    console.log("Token acquired!");

    // 2. Fetch User Requests
    console.log("Fetching User Requests...");
    const userReqs = await axios.get('https://payroll-new-southpointbackend-production.up.railway.app/api/superadmin/user-requests', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("User Requests:", userReqs.data.data);

    // 3. Fetch Company Requests
    console.log("Fetching Company Requests...");
    const compReqs = await axios.get('https://payroll-new-southpointbackend-production.up.railway.app/api/superadmin/company-requests', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Company Requests:", compReqs.data.data);

  } catch (err) {
    console.error("FAIL:", err.response ? err.response.data : err.message);
  }
}
fetchLive();
