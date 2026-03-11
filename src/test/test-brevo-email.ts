import { emailService } from '../services/emailService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testBrevoEmail() {
  console.log('🧪 Testing Brevo Email Configuration');
  console.log('=====================================');

  // Check if environment variables are set
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  console.log('📧 Environment Variables:');
  console.log(`   API Key: ${apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET'}`);
  console.log(`   From Email: ${fromEmail || 'NOT SET'}`);
  console.log(`   From Name: ${fromName || 'NOT SET'}`);

  if (!apiKey || !fromEmail) {
    console.error('❌ Missing required environment variables');
    return;
  }

  console.log('\n🔧 Testing Email Service Initialization...');
  
  // Test OTP email (this will log in development mode if not configured)
  console.log('\n📤 Testing OTP Email...');
  const otpResult = await emailService.sendOTPEmail(
    'test@example.com',
    '123456',
    'email_verification'
  );
  
  console.log(`OTP Email Result: ${otpResult ? '✅ Success' : '❌ Failed'}`);
  
  // Test welcome email
  console.log('\n📤 Testing Welcome Email...');
  const welcomeResult = await emailService.sendWelcomeEmail(
    'test@example.com',
    'Test User'
  );
  
  console.log(`Welcome Email Result: ${welcomeResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n🎉 Test completed!');
}

// Run the test
testBrevoEmail().catch(console.error);
