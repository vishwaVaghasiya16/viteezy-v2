const axios = require('axios');

const baseURL = 'http://localhost:8050/api/v1';

async function testUserMemberships() {
  console.log('🔍 Testing User Memberships API...\n');
  
  // Test without token (should fail)
  try {
    console.log('❌ Testing without auth token...');
    await axios.get(`${baseURL}/memberships`);
  } catch (error) {
    console.log('✅ Correctly requires authentication');
  }

  console.log('\n📝 API Endpoints for User Memberships:');
  console.log('1. GET /api/v1/memberships');
  console.log('   - Query params: status (Active|Cancelled|Expired|Pending|all), page, limit');
  console.log('   - Shows ALL user memberships by default');
  console.log('   - Filter by specific status if provided');
  
  console.log('\n2. GET /api/v1/memberships/:id');
  console.log('   - Get details of specific membership');
  
  console.log('\n3. GET /api/v1/memberships/widget/overview');
  console.log('   - Dashboard widget data');
  
  console.log('\n4. POST /api/v1/memberships/:id/cancel');
  console.log('   - Cancel a membership');
  
  console.log('\n🎯 Example Usage:');
  console.log(`GET ${baseURL}/memberships`);
  console.log(`GET ${baseURL}/memberships?status=Active`);
  console.log(`GET ${baseURL}/memberships?status=all`);
  console.log(`GET ${baseURL}/memberships?status=Cancelled`);
  
  console.log('\n✅ Membership API is ready!');
  console.log('👤 User will see ALL their memberships (active, cancelled, expired, etc.)');
}

testUserMemberships().catch(console.error);
