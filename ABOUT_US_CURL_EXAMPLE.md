# About Us API - Simplified cURL Examples

## POST /api/v1/admin/about-us

### Complete Example (All Sections)

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'banner_image=@"/path/to/banner-image.png"' \
--form 'banner_banner_title="Welcome to Our Company"' \
--form 'banner_banner_description="We are passionate about innovation and excellence"' \
--form 'banner_banner_button_text="Learn More"' \
--form 'banner_banner_button_link="https://example.com"' \
--form 'founder_image=@"/path/to/founder-image.png"' \
--form 'founderQuote_founder_quote_text="Innovation drives everything we do."' \
--form 'founderQuote_founder_name="John Doe"' \
--form 'founderQuote_founder_designation="CEO & Founder"' \
--form 'founderQuote_note="With over 20 years of experience"' \
--form 'meet_brains_main_image=@"/path/to/meet-brains-image.png"' \
--form 'meetBrains_meet_brains_title="Meet Our Team"' \
--form 'meetBrains_meet_brains_subtitle="The brilliant minds behind our success"' \
--form 'timeline_timeline_section_title="Our Journey"' \
--form 'timeline_timeline_section_description="Key milestones in our history"' \
--form 'timeline_timeline_events_0_year="2023"' \
--form 'timeline_timeline_events_0_title="Major Expansion"' \
--form 'timeline_timeline_events_0_description="Expanded to 10 countries"' \
--form 'timeline_timeline_events_0_order="0"' \
--form 'timeline_timeline_events_1_year="2022"' \
--form 'timeline_timeline_events_1_title="First Milestone"' \
--form 'timeline_timeline_events_1_description="Reached 1000 customers"' \
--form 'timeline_timeline_events_1_order="1"' \
--form 'timeline_timeline_events_2_year="2020"' \
--form 'timeline_timeline_events_2_title="Company Founded"' \
--form 'timeline_timeline_events_2_description="Started with a team of 5"' \
--form 'timeline_timeline_events_2_order="2"' \
--form 'people_title="Our People"' \
--form 'people_subtitle="Meet the amazing team"' \
--form 'people_images=@"/path/to/people-image-1.png"' \
--form 'people_images=@"/path/to/people-image-2.png"' \
--form 'people_images=@"/path/to/people-image-3.png"'
```

### Minimal Example (Only Required Fields)

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'banner_banner_title="Welcome to Our Company"' \
--form 'people_title="Our People"'
```

### Banner Section Only

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'banner_image=@"/path/to/banner-image.png"' \
--form 'banner_banner_title="Welcome to Our Company"' \
--form 'banner_banner_description="We are passionate about innovation and excellence"' \
--form 'banner_banner_button_text="Learn More"' \
--form 'banner_banner_button_link="https://example.com"'
```

### Founder Quote Section Only

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'founder_image=@"/path/to/founder-image.png"' \
--form 'founderQuote_founder_quote_text="Innovation drives everything we do."' \
--form 'founderQuote_founder_name="John Doe"' \
--form 'founderQuote_founder_designation="CEO & Founder"' \
--form 'founderQuote_note="With over 20 years of experience"'
```

### Timeline Section with Multiple Events

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'timeline_timeline_section_title="Our Journey"' \
--form 'timeline_timeline_section_description="Key milestones in our history"' \
--form 'timeline_timeline_events_0_year="2023"' \
--form 'timeline_timeline_events_0_title="Major Expansion"' \
--form 'timeline_timeline_events_0_description="Expanded to 10 countries"' \
--form 'timeline_timeline_events_0_order="0"' \
--form 'timeline_timeline_events_1_year="2022"' \
--form 'timeline_timeline_events_1_title="First Milestone"' \
--form 'timeline_timeline_events_1_description="Reached 1000 customers"' \
--form 'timeline_timeline_events_1_order="1"'
```

### People Section with Multiple Images

```bash
curl --location 'http://139.59.32.181:8050/api/v1/admin/about-us' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--form 'people_title="Our People"' \
--form 'people_subtitle="Meet the amazing team"' \
--form 'people_images=@"/path/to/image1.png"' \
--form 'people_images=@"/path/to/image2.png"' \
--form 'people_images=@"/path/to/image3.png"'
```

## Key Points:

1. **No Language Suffixes Needed**: Just use the field name without `_en`, `_nl`, `_de`, `_fr`, `_es` - the system will auto-translate to all languages.

2. **Field Naming Pattern**:
   - Banner: `banner_banner_title`, `banner_banner_description`, `banner_banner_button_text`
   - Founder Quote: `founderQuote_founder_quote_text`, `founderQuote_founder_name`, `founderQuote_founder_designation`, `founderQuote_note`
   - Meet Brains: `meetBrains_meet_brains_title`, `meetBrains_meet_brains_subtitle`
   - Timeline: `timeline_timeline_section_title`, `timeline_timeline_section_description`
   - Timeline Events: `timeline_timeline_events_0_title`, `timeline_timeline_events_0_description`, `timeline_timeline_events_0_year`, `timeline_timeline_events_0_order`
   - People: `people_title`, `people_subtitle`

3. **File Uploads**:
   - `banner_image` - Single file
   - `founder_image` - Single file
   - `meet_brains_main_image` - Single file
   - `people_images` - Multiple files (up to 20)

4. **Timeline Events Array**: Use index numbers (0, 1, 2, etc.) for multiple events.

5. **All text fields will be automatically translated** to: English (en), Dutch (nl), German (de), French (fr), and Spanish (es).

