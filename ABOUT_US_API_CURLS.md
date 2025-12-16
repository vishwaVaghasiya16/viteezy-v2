# About Us API - cURL Commands

**Base URL:** `http://localhost:8050/api/v1`  
**Admin Token:** Replace `<YOUR_ADMIN_TOKEN>` with your actual JWT token

---

## Public API (No Authentication)

### 1. Get About Us Page Content

```bash
curl -X GET \
  http://localhost:8050/api/v1/about-us \
  -H 'Content-Type: application/json'
```

---

## Admin APIs (Require Admin Authentication)

### 2. Get About Us Page Content (Admin)

```bash
curl -X GET \
  http://localhost:8050/api/v1/admin/about-us \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -H 'Content-Type: application/json'
```

### 3. Create/Update About Us Page (POST - Form Data with Images)

```bash
curl -X POST \
  http://localhost:8050/api/v1/admin/about-us \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'banner_image=@/path/to/banner.jpg' \
  -F 'meet_brains_main_image=@/path/to/meet-brains.jpg' \
  -F 'banner_banner_title_en=Welcome to Our Company' \
  -F 'banner_banner_subtitle_en=We are passionate about innovation' \
  -F 'banner_banner_button_text_en=Learn More' \
  -F 'banner_banner_button_link=https://example.com' \
  -F 'founderQuote_founder_quote_text_en=Innovation drives everything we do' \
  -F 'founderQuote_founder_name_en=John Doe' \
  -F 'founderQuote_founder_designation_en=CEO & Founder' \
  -F 'meetBrains_meet_brains_title_en=Meet Our Team' \
  -F 'meetBrains_meet_brains_subtitle_en=The brilliant minds behind our success' \
  -F 'timeline_timeline_section_title_en=Our Journey' \
  -F 'timeline_timeline_events_0_year=2020' \
  -F 'timeline_timeline_events_0_title_en=Company Founded' \
  -F 'timeline_timeline_events_0_order=1' \
  -F 'people_title_en=Our People' \
  -F 'people_subtitle_en=Meet the amazing team'
```

### 4. Update About Us Page (PUT - Form Data)

```bash
curl -X PUT \
  http://localhost:8050/api/v1/admin/about-us \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'banner_banner_title_en=Updated Welcome Message' \
  -F 'banner_banner_subtitle_en=Updated subtitle'
```

### 5. Update Banner Section Only (PATCH)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/banner \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'banner_image=@/path/to/new-banner.jpg' \
  -F 'banner_title_en=New Banner Title' \
  -F 'banner_subtitle_en=New Banner Subtitle' \
  -F 'banner_button_text_en=Click Here' \
  -F 'banner_button_link=https://example.com/new-link'
```

### 6. Update Founder Quote Section Only (PATCH)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/founderQuote \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'founder_quote_text_en=New quote from founder' \
  -F 'founder_name_en=Jane Smith' \
  -F 'founder_designation_en=CTO & Co-Founder' \
  -F 'note_en=Updated note about the founder'
```

### 7. Update Meet Brains Section Only (PATCH)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/meetBrains \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'meet_brains_main_image=@/path/to/new-image.jpg' \
  -F 'meet_brains_title_en=Meet Our Brilliant Team' \
  -F 'meet_brains_subtitle_en=The experts behind innovation'
```

### 8. Update Timeline Section Only (PATCH)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/timeline \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'timeline_section_title_en=Our History' \
  -F 'timeline_section_description_en=Important moments in our journey' \
  -F 'timeline_events_0_year=2019' \
  -F 'timeline_events_0_title_en=Idea Conception' \
  -F 'timeline_events_0_description_en=The idea was born' \
  -F 'timeline_events_0_order=0' \
  -F 'timeline_events_1_year=2020' \
  -F 'timeline_events_1_title_en=Company Founded' \
  -F 'timeline_events_1_order=1'
```

### 9. Update People Section Only (PATCH)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/people \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -F 'title_en=Our Amazing Team' \
  -F 'subtitle_en=Meet the people who make it happen'
```

### 10. Delete About Us Page (Soft Delete)

```bash
curl -X DELETE \
  http://localhost:8050/api/v1/admin/about-us \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -H 'Content-Type: application/json'
```

---

## JSON Format Examples

### 11. Create/Update About Us Page (POST - JSON)

```bash
curl -X POST \
  http://localhost:8050/api/v1/admin/about-us \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "banner": {
      "banner_image": {
        "type": "image",
        "url": "https://example.com/banner.jpg",
        "alt": {
          "en": "Banner image"
        }
      },
      "banner_title": {
        "en": "Welcome to Our Company",
        "nl": "Welkom bij ons bedrijf"
      },
      "banner_subtitle": {
        "en": "We are passionate about innovation"
      },
      "banner_button_text": {
        "en": "Learn More"
      },
      "banner_button_link": "https://example.com"
    },
    "founderQuote": {
      "founder_quote_text": {
        "en": "Innovation drives everything we do"
      },
      "founder_name": {
        "en": "John Doe"
      },
      "founder_designation": {
        "en": "CEO & Founder"
      },
      "note": {
        "en": "This is a note about the founder"
      }
    },
    "meetBrains": {
      "meet_brains_title": {
        "en": "Meet Our Team"
      },
      "meet_brains_subtitle": {
        "en": "The brilliant minds behind our success"
      },
      "meet_brains_main_image": {
        "type": "image",
        "url": "https://example.com/team.jpg"
      }
    },
    "timeline": {
      "timeline_section_title": {
        "en": "Our Journey"
      },
      "timeline_section_description": {
        "en": "Key milestones in our history"
      },
      "timeline_events": [
        {
          "year": "2020",
          "title": {
            "en": "Company Founded"
          },
          "description": {
            "en": "We started our journey"
          },
          "order": 1
        },
        {
          "year": "2022",
          "title": {
            "en": "First Major Milestone"
          },
          "description": {
            "en": "Reached 1000 customers"
          },
          "order": 2
        }
      ]
    },
    "people": {
      "title": {
        "en": "Our People"
      },
      "subtitle": {
        "en": "Meet the amazing team"
      }
    }
  }'
```

### 12. Update Banner Section (PATCH - JSON)

```bash
curl -X PATCH \
  http://localhost:8050/api/v1/admin/about-us/sections/banner \
  -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "banner_image": {
      "type": "image",
      "url": "https://example.com/new-banner.jpg"
    },
    "banner_title": {
      "en": "New Banner Title",
      "nl": "Nieuwe Banner Titel"
    },
    "banner_subtitle": {
      "en": "New Banner Subtitle"
    },
    "banner_button_text": {
      "en": "Click Here"
    },
    "banner_button_link": "https://example.com/new-link"
  }'
```

---

## Notes

1. **Authentication:** All admin routes require `Authorization: Bearer <TOKEN>` header
2. **File Uploads:** Use `-F` flag with `@path/to/file` for image uploads
3. **Form Data:** Use underscore notation (e.g., `banner_banner_title_en`)
4. **JSON Format:** Use nested objects for JSON requests
5. **Section Names:** Valid section names are: `banner`, `founderQuote`, `meetBrains`, `timeline`, `people`
6. **Languages:** Supported languages: `en`, `nl`, `de`, `fr`, `es`
