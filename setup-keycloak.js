/**
 * Keycloak Realm Setup Script
 * 
 * Run this AFTER Keycloak is started (docker compose up) to automatically
 * create the realm, client, and admin user.
 * 
 * Usage: node setup-keycloak.js
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

async function setup() {
  console.log('\n🔧 Setting up Keycloak for Employee Management System...\n');

  try {
    // 1. Get admin token
    console.log('1. Getting admin access token...');
    const tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: ADMIN_USER,
        password: ADMIN_PASS
      })
    });
    if (!tokenRes.ok) throw new Error(`Failed to get admin token: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json();
    console.log('   ✅ Admin token obtained\n');

    const headers = {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    };

    // 2. Create realm
    console.log('2. Creating realm "ems-realm"...');
    const realmRes = await fetch(`${KEYCLOAK_URL}/admin/realms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        realm: 'ems-realm',
        enabled: true,
        displayName: 'Employee Management System',
        registrationAllowed: false,
        loginWithEmailAllowed: true,
        duplicateEmailsAllowed: false
      })
    });
    if (realmRes.status === 409) {
      console.log('   ⚠️  Realm already exists, skipping...\n');
    } else if (!realmRes.ok) {
      throw new Error(`Failed to create realm: ${realmRes.status}`);
    } else {
      console.log('   ✅ Realm created\n');
    }

    // 3. Create client
    console.log('3. Creating client "ems-app"...');
    const clientRes = await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: 'ems-app',
        name: 'Employee Management System',
        enabled: true,
        publicClient: true,
        directAccessGrantsEnabled: true,
        standardFlowEnabled: true,
        implicitFlowEnabled: false,
        rootUrl: 'http://localhost:4200',
        baseUrl: '/',
        redirectUris: ['http://localhost:4200/*'],
        webOrigins: ['http://localhost:4200'],
        protocol: 'openid-connect',
        attributes: {
          'post.logout.redirect.uris': 'http://localhost:4200/*'
        }
      })
    });
    if (clientRes.status === 409) {
      console.log('   ⚠️  Client already exists, skipping...\n');
    } else if (!clientRes.ok) {
      const err = await clientRes.text();
      throw new Error(`Failed to create client: ${clientRes.status} ${err}`);
    } else {
      console.log('   ✅ Client created\n');
    }

    // 4. Create admin role
    console.log('4. Creating "ems-admin" realm role...');
    const roleRes = await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'ems-admin',
        description: 'Administrator role for Employee Management System'
      })
    });
    if (roleRes.status === 409) {
      console.log('   ⚠️  Role already exists, skipping...\n');
    } else if (!roleRes.ok) {
      console.log(`   ⚠️  Role creation returned ${roleRes.status}, may already exist\n`);
    } else {
      console.log('   ✅ Role created\n');
    }

    // 5. Create a default admin user
    console.log('5. Creating default user "emsadmin"...');
    const userRes = await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: 'emsadmin',
        email: 'admin@ems.com',
        firstName: 'EMS',
        lastName: 'Admin',
        enabled: true,
        emailVerified: true,
        credentials: [{
          type: 'password',
          value: 'admin123',
          temporary: false
        }]
      })
    });
    if (userRes.status === 409) {
      console.log('   ⚠️  User already exists, skipping...\n');
    } else if (!userRes.ok) {
      const err = await userRes.text();
      console.log(`   ⚠️  User creation: ${userRes.status} - ${err}\n`);
    } else {
      console.log('   ✅ User created\n');

      // Assign role to user
      console.log('6. Assigning "ems-admin" role to user...');
      // Get user ID
      const usersListRes = await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/users?username=emsadmin`, { headers });
      const users = await usersListRes.json();
      if (users.length > 0) {
        const userId = users[0].id;
        // Get role
        const roleGetRes = await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/roles/ems-admin`, { headers });
        if (roleGetRes.ok) {
          const role = await roleGetRes.json();
          await fetch(`${KEYCLOAK_URL}/admin/realms/ems-realm/users/${userId}/role-mappings/realm`, {
            method: 'POST',
            headers,
            body: JSON.stringify([role])
          });
          console.log('   ✅ Role assigned\n');
        }
      }
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ Keycloak setup complete!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  Keycloak Admin Console: http://localhost:8080/admin');
    console.log('  Admin Login:            admin / admin');
    console.log('');
    console.log('  EMS User Login:         emsadmin / admin123');
    console.log('  EMS App:                http://localhost:4200');
    console.log('');
    console.log('═══════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    console.error('\nMake sure Keycloak is running: docker compose up -d');
    console.error('Then wait ~30 seconds and try again: node setup-keycloak.js\n');
    process.exit(1);
  }
}

setup();
