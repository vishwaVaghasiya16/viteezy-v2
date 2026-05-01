# DigitalOcean Spaces Configuration Guide

## Error: "The specified bucket does not exist"

This error occurs when the DigitalOcean Spaces bucket is not configured correctly or doesn't exist.

## Solution

### 1. Check Your Environment Variables

Make sure you have the following environment variables set in your `.env` file:

```env
# Option 1: Using DO_SPACES_* variables (recommended)
DIGITALOCEAN_SPACES_ENDPOINT=https://blr1.digitaloceanspaces.com
DIGITALOCEAN_SPACES_REGION=blr1
DIGITALOCEAN_BUCKET_NAME=your-bucket-name
DIGITALOCEAN_ACCESS_KEY=your-access-key
DIGITALOCEAN_SPACES_SECRET_KEY=your-secret-key

# Option 2: Using DIGITALOCEAN_* variables (alternative)
DIGITALOCEAN_CALLBACK_URL=https://blr1.digitaloceanspaces.com
DIGITALOCEAN_SPACES_REGION=blr1
DIGITALOCEAN_BUCKET_NAME=your-bucket-name
DIGITALOCEAN_ACCESS_KEY=your-access-key
DIGITALOCEAN_CLIENT_SECRET=your-secret-key
```

### 2. Verify Your Bucket Exists

1. Log in to [DigitalOcean Control Panel](https://cloud.digitalocean.com/)
2. Go to **Spaces** section
3. Verify your bucket exists and note:
   - **Bucket name** (exactly as shown)
   - **Region** (e.g., `blr1`, `ams3`, `nyc3`)
   - **Endpoint** (format: `https://{region}.digitaloceanspaces.com`)

### 3. Get Your Access Keys

1. In DigitalOcean Control Panel, go to **API** → **Spaces Keys**
2. Generate a new key pair or use existing ones
3. Copy:
   - **Access Key** → `DIGITALOCEAN_ACCESS_KEY` or `DIGITALOCEAN_ACCESS_KEY`
   - **Secret Key** → `DIGITALOCEAN_SPACES_SECRET_KEY` or `DIGITALOCEAN_CLIENT_SECRET`

### 4. Common Issues

#### Issue: Bucket name mismatch

- **Problem**: Bucket name in env doesn't match actual bucket name
- **Solution**: Check exact bucket name (case-sensitive) in DigitalOcean dashboard

#### Issue: Wrong region

- **Problem**: Region in env doesn't match bucket region
- **Solution**: Use the exact region code (e.g., `blr1`, `ams3`, `nyc3`)

#### Issue: Endpoint format

- **Problem**: Endpoint URL is incorrect
- **Solution**: Use format `https://{region}.digitaloceanspaces.com`
  - For `blr1`: `https://blr1.digitaloceanspaces.com`
  - For `ams3`: `https://ams3.digitaloceanspaces.com`

#### Issue: Access keys don't have permissions

- **Problem**: Keys don't have read/write access to the bucket
- **Solution**: Regenerate keys or check bucket permissions

### 5. Test Configuration

After updating your `.env` file, restart your server and try uploading again.

The system will now:

- ✅ Log detailed error messages if bucket doesn't exist
- ✅ Allow blog creation without cover image if upload fails
- ✅ Show which configuration fields are missing

### 6. Optional: CDN Configuration

If you're using a CDN in front of Spaces:

```env
DO_SPACES_CDN_BASE_URL=https://cdn.your-domain.com
```

This will use the CDN URL instead of the direct Spaces URL for file access.

### 7. Temporary Workaround

If you need to create blogs without images while fixing the configuration:

1. **Don't include the `coverImage` field** in your request
2. The blog will be created with `coverImage: null`
3. You can update it later once Spaces is configured

## Example Working Configuration

```env
DIGITALOCEAN_SPACES_ENDPOINT=https://blr1.digitaloceanspaces.com
DIGITALOCEAN_SPACES_REGION=blr1
DIGITALOCEAN_BUCKET_NAME=milestone
DIGITALOCEAN_ACCESS_KEY=DO00R47LPRMJ9Y9BYA8D
DIGITALOCEAN_SPACES_SECRET_KEY=Lg4PgTjE+g8Nnx0oHSpwZ6p/NHK4Qv01bcVfRSb1dYk
```

**Note**: Replace with your actual credentials. Never commit real credentials to version control.
