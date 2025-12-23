# PostNL Address Validation Test - cURL Commands

## Test Addresses for PostNL Validation

### ✅ Verified Address (Will Pass Validation)

#### Netherlands (NL) - Valid Address

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "streetName": "Damrak",
    "houseNumber": "1",
    "houseNumberAddition": "",
    "postalCode": "1012LG",
    "address": "Damrak 1, 1012LG Amsterdam",
    "phone": "+31612345678",
    "country": "NL",
    "city": "Amsterdam",
    "isDefault": true,
    "note": "Test verified address"
  }'
```

#### Belgium (BE) - Valid Address

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "streetName": "Rue de la Loi",
    "houseNumber": "16",
    "houseNumberAddition": "",
    "postalCode": "1000",
    "address": "Rue de la Loi 16, 1000 Brussels",
    "phone": "+3212345678",
    "country": "BE",
    "city": "Brussels",
    "isDefault": false,
    "note": "Test verified Belgium address"
  }'
```

#### Luxembourg (LU) - Valid Address

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Pierre",
    "lastName": "Dubois",
    "streetName": "Rue de la Poste",
    "houseNumber": "42",
    "houseNumberAddition": "",
    "postalCode": "L-2345",
    "address": "Rue de la Poste 42, L-2345 Luxembourg",
    "phone": "+352123456",
    "country": "LU",
    "city": "Luxembourg",
    "isDefault": false,
    "note": "Test verified Luxembourg address"
  }'
```

---

### ❌ Unverified Address (Will Fail Validation)

#### Netherlands (NL) - Invalid Address (Wrong Postal Code)

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "streetName": "Damrak",
    "houseNumber": "1",
    "houseNumberAddition": "",
    "postalCode": "9999XX",
    "address": "Damrak 1, 9999XX Amsterdam",
    "phone": "+31612345678",
    "country": "NL",
    "city": "Amsterdam",
    "isDefault": false,
    "note": "Test unverified address - invalid postal code"
  }'
```

#### Netherlands (NL) - Invalid Address (Wrong House Number)

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "streetName": "Damrak",
    "houseNumber": "99999",
    "houseNumberAddition": "",
    "postalCode": "1012LG",
    "address": "Damrak 99999, 1012LG Amsterdam",
    "phone": "+31612345678",
    "country": "NL",
    "city": "Amsterdam",
    "isDefault": false,
    "note": "Test unverified address - invalid house number"
  }'
```

#### Belgium (BE) - Invalid Address (Wrong Postal Code)

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "streetName": "Rue de la Loi",
    "houseNumber": "16",
    "houseNumberAddition": "",
    "postalCode": "9999",
    "address": "Rue de la Loi 16, 9999 Brussels",
    "phone": "+3212345678",
    "country": "BE",
    "city": "Brussels",
    "isDefault": false,
    "note": "Test unverified address - invalid postal code"
  }'
```

---

## Expected Responses

### ✅ Success Response (Verified Address)

```json
{
  "success": true,
  "message": "Address added successfully",
  "data": {
    "address": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "streetName": "Damrak", // Normalized by PostNL
      "houseNumber": "1",
      "postalCode": "1012LG", // Verified by PostNL
      "address": "Damrak 1, 1012LG Amsterdam",
      "country": "NL",
      "city": "Amsterdam", // Verified by PostNL
      "isDefault": true
    }
  }
}
```

### ❌ Error Response (Unverified Address)

```json
{
  "success": false,
  "message": "Invalid address. Please verify the address details and try again.",
  "error": {
    "statusCode": 400,
    "message": "Invalid address. Please verify the address details and try again."
  }
}
```

---

## Quick Test Commands

### Test Verified NL Address (Copy-Paste Ready)

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"firstName":"John","lastName":"Doe","streetName":"Damrak","houseNumber":"1","postalCode":"1012LG","address":"Damrak 1, 1012LG Amsterdam","country":"NL","city":"Amsterdam","isDefault":true}'
```

### Test Unverified NL Address (Copy-Paste Ready)

```bash
curl -X POST http://localhost:3000/api/v1/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"firstName":"Test","lastName":"User","streetName":"Damrak","houseNumber":"99999","postalCode":"1012LG","address":"Damrak 99999, 1012LG Amsterdam","country":"NL","city":"Amsterdam","isDefault":false}'
```

---

## Notes

1. **Replace `YOUR_JWT_TOKEN`** with your actual JWT token
2. **Verified addresses** will be saved successfully after PostNL validation
3. **Unverified addresses** will be rejected with 400 error
4. **PostNL API key** must be configured in `.env` file
5. Only **NL, BE, LU** countries require PostNL validation
