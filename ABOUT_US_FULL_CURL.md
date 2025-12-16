# Complete About Us API - Full cURL with All 5 Languages

**Base URL:** `http://localhost:8080/api/v1`  
**Admin Token:** Replace `<YOUR_ADMIN_TOKEN>` with your actual JWT token  
**Image Paths:** Replace image paths with your actual file paths

## Complete cURL Command (All Sections + All 5 Languages)

```bash
curl --location 'http://localhost:8080/api/v1/admin/about-us' \
--header 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' \
--form 'banner_image=@"/path/to/banner.jpg"' \
--form 'meet_brains_main_image=@"/path/to/meet-brains.jpg"' \
\
--form 'banner_banner_title_en="Welcome to Our Company"' \
--form 'banner_banner_title_nl="Welkom bij ons bedrijf"' \
--form 'banner_banner_title_de="Willkommen bei unserem Unternehmen"' \
--form 'banner_banner_title_fr="Bienvenue dans notre entreprise"' \
--form 'banner_banner_title_es="Bienvenido a nuestra empresa"' \
\
--form 'banner_banner_subtitle_en="We are passionate about innovation and excellence"' \
--form 'banner_banner_subtitle_nl="We zijn gepassioneerd over innovatie en excellentie"' \
--form 'banner_banner_subtitle_de="Wir sind leidenschaftlich über Innovation und Exzellenz"' \
--form 'banner_banner_subtitle_fr="Nous sommes passionnés par l'\''innovation et l'\''excellence"' \
--form 'banner_banner_subtitle_es="Estamos apasionados por la innovación y la excelencia"' \
\
--form 'banner_banner_button_text_en="Learn More"' \
--form 'banner_banner_button_text_nl="Meer Weten"' \
--form 'banner_banner_button_text_de="Mehr Erfahren"' \
--form 'banner_banner_button_text_fr="En Savoir Plus"' \
--form 'banner_banner_button_text_es="Saber Más"' \
\
--form 'banner_banner_button_link="https://example.com"' \
\
--form 'founderQuote_founder_quote_text_en="Innovation drives everything we do. We believe in creating solutions that make a difference."' \
--form 'founderQuote_founder_quote_text_nl="Innovatie drijft alles wat we doen. We geloven in het creëren van oplossingen die het verschil maken."' \
--form 'founderQuote_founder_quote_text_de="Innovation treibt alles an, was wir tun. Wir glauben daran, Lösungen zu schaffen, die einen Unterschied machen."' \
--form 'founderQuote_founder_quote_text_fr="L'\''innovation motive tout ce que nous faisons. Nous croyons en la création de solutions qui font la différence."' \
--form 'founderQuote_founder_quote_text_es="La innovación impulsa todo lo que hacemos. Creemos en crear soluciones que marquen la diferencia."' \
\
--form 'founderQuote_founder_name_en="John Doe"' \
--form 'founderQuote_founder_name_nl="Jan Janssen"' \
--form 'founderQuote_founder_name_de="Hans Schmidt"' \
--form 'founderQuote_founder_name_fr="Jean Dupont"' \
--form 'founderQuote_founder_name_es="Juan García"' \
\
--form 'founderQuote_founder_designation_en="CEO & Founder"' \
--form 'founderQuote_founder_designation_nl="CEO & Oprichter"' \
--form 'founderQuote_founder_designation_de="CEO & Gründer"' \
--form 'founderQuote_founder_designation_fr="PDG & Fondateur"' \
--form 'founderQuote_founder_designation_es="CEO y Fundador"' \
\
--form 'founderQuote_note_en="With over 20 years of experience in the industry"' \
--form 'founderQuote_note_nl="Met meer dan 20 jaar ervaring in de industrie"' \
--form 'founderQuote_note_de="Mit über 20 Jahren Erfahrung in der Branche"' \
--form 'founderQuote_note_fr="Avec plus de 20 ans d'\''expérience dans l'\''industrie"' \
--form 'founderQuote_note_es="Con más de 20 años de experiencia en la industria"' \
\
--form 'meetBrains_meet_brains_title_en="Meet Our Team"' \
--form 'meetBrains_meet_brains_title_nl="Ontmoet Ons Team"' \
--form 'meetBrains_meet_brains_title_de="Lernen Sie Unser Team Kennen"' \
--form 'meetBrains_meet_brains_title_fr="Rencontrez Notre Équipe"' \
--form 'meetBrains_meet_brains_title_es="Conoce Nuestro Equipo"' \
\
--form 'meetBrains_meet_brains_subtitle_en="The brilliant minds behind our success"' \
--form 'meetBrains_meet_brains_subtitle_nl="De briljante geesten achter ons succes"' \
--form 'meetBrains_meet_brains_subtitle_de="Die brillanten Köpfe hinter unserem Erfolg"' \
--form 'meetBrains_meet_brains_subtitle_fr="Les esprits brillants derrière notre succès"' \
--form 'meetBrains_meet_brains_subtitle_es="Las mentes brillantes detrás de nuestro éxito"' \
\
--form 'timeline_timeline_section_title_en="Our Journey"' \
--form 'timeline_timeline_section_title_nl="Onze Reis"' \
--form 'timeline_timeline_section_title_de="Unsere Reise"' \
--form 'timeline_timeline_section_title_fr="Notre Parcours"' \
--form 'timeline_timeline_section_title_es="Nuestro Viaje"' \
\
--form 'timeline_timeline_section_description_en="Key milestones in our company'\''s history"' \
--form 'timeline_timeline_section_description_nl="Belangrijke mijlpalen in de geschiedenis van ons bedrijf"' \
--form 'timeline_timeline_section_description_de="Wichtige Meilensteine in der Geschichte unseres Unternehmens"' \
--form 'timeline_timeline_section_description_fr="Jalons importants de l'\''histoire de notre entreprise"' \
--form 'timeline_timeline_section_description_es="Hitos clave en la historia de nuestra empresa"' \
\
--form 'timeline_timeline_events_0_year="2019"' \
--form 'timeline_timeline_events_0_title_en="Idea Conception"' \
--form 'timeline_timeline_events_0_title_nl="Idee Conceptie"' \
--form 'timeline_timeline_events_0_title_de="Idee Konzeption"' \
--form 'timeline_timeline_events_0_title_fr="Conception de l'\''Idée"' \
--form 'timeline_timeline_events_0_title_es="Concepción de la Idea"' \
--form 'timeline_timeline_events_0_description_en="The idea was born from a vision to revolutionize the industry"' \
--form 'timeline_timeline_events_0_description_nl="Het idee ontstond uit een visie om de industrie te revolutioneren"' \
--form 'timeline_timeline_events_0_description_de="Die Idee entstand aus einer Vision, die Branche zu revolutionieren"' \
--form 'timeline_timeline_events_0_description_fr="L'\''idée est née d'\''une vision de révolutionner l'\''industrie"' \
--form 'timeline_timeline_events_0_description_es="La idea nació de una visión de revolucionar la industria"' \
--form 'timeline_timeline_events_0_order="0"' \
\
--form 'timeline_timeline_events_1_year="2020"' \
--form 'timeline_timeline_events_1_title_en="Company Founded"' \
--form 'timeline_timeline_events_1_title_nl="Bedrijf Opgericht"' \
--form 'timeline_timeline_events_1_title_de="Unternehmen Gegründet"' \
--form 'timeline_timeline_events_1_title_fr="Entreprise Fondée"' \
--form 'timeline_timeline_events_1_title_es="Empresa Fundada"' \
--form 'timeline_timeline_events_1_description_en="We officially launched our company with a team of 5 passionate individuals"' \
--form 'timeline_timeline_events_1_description_nl="We hebben ons bedrijf officieel gelanceerd met een team van 5 gepassioneerde individuen"' \
--form 'timeline_timeline_events_1_description_de="Wir haben unser Unternehmen offiziell mit einem Team von 5 leidenschaftlichen Personen gegründet"' \
--form 'timeline_timeline_events_1_description_fr="Nous avons officiellement lancé notre entreprise avec une équipe de 5 personnes passionnées"' \
--form 'timeline_timeline_events_1_description_es="Lanzamos oficialmente nuestra empresa con un equipo de 5 personas apasionadas"' \
--form 'timeline_timeline_events_1_order="1"' \
\
--form 'timeline_timeline_events_2_year="2022"' \
--form 'timeline_timeline_events_2_title_en="First Major Milestone"' \
--form 'timeline_timeline_events_2_title_nl="Eerste Grote Mijlpaal"' \
--form 'timeline_timeline_events_2_title_de="Erster Großer Meilenstein"' \
--form 'timeline_timeline_events_2_title_fr="Premier Jalon Majeur"' \
--form 'timeline_timeline_events_2_title_es="Primer Hito Importante"' \
--form 'timeline_timeline_events_2_description_en="Reached 1000 customers and expanded to 3 countries"' \
--form 'timeline_timeline_events_2_description_nl="Bereikte 1000 klanten en uitgebreid naar 3 landen"' \
--form 'timeline_timeline_events_2_description_de="Erreichte 1000 Kunden und expandierte in 3 Länder"' \
--form 'timeline_timeline_events_2_description_fr="Atteint 1000 clients et étendu à 3 pays"' \
--form 'timeline_timeline_events_2_description_es="Alcanzamos 1000 clientes y nos expandimos a 3 países"' \
--form 'timeline_timeline_events_2_order="2"' \
\
--form 'timeline_timeline_events_3_year="2023"' \
--form 'timeline_timeline_events_3_title_en="Major Expansion"' \
--form 'timeline_timeline_events_3_title_nl="Grote Uitbreiding"' \
--form 'timeline_timeline_events_3_title_de="Große Expansion"' \
--form 'timeline_timeline_events_3_title_fr="Expansion Majeure"' \
--form 'timeline_timeline_events_3_title_es="Gran Expansión"' \
--form 'timeline_timeline_events_3_description_en="Expanded to 10 countries and launched our flagship product"' \
--form 'timeline_timeline_events_3_description_nl="Uitgebreid naar 10 landen en gelanceerd ons vlaggenschipproduct"' \
--form 'timeline_timeline_events_3_description_de="Erweitert auf 10 Länder und unser Flaggschiffprodukt gestartet"' \
--form 'timeline_timeline_events_3_description_fr="Étendu à 10 pays et lancé notre produit phare"' \
--form 'timeline_timeline_events_3_description_es="Expandido a 10 países y lanzado nuestro producto estrella"' \
--form 'timeline_timeline_events_3_order="3"' \
\
--form 'people_title_en="Our People"' \
--form 'people_title_nl="Onze Mensen"' \
--form 'people_title_de="Unsere Leute"' \
--form 'people_title_fr="Nos Gens"' \
--form 'people_title_es="Nuestra Gente"' \
\
--form 'people_subtitle_en="Meet the amazing team that makes everything possible"' \
--form 'people_subtitle_nl="Ontmoet het geweldige team dat alles mogelijk maakt"' \
--form 'people_subtitle_de="Lernen Sie das erstaunliche Team kennen, das alles möglich macht"' \
--form 'people_subtitle_fr="Rencontrez l'\''équipe incroyable qui rend tout possible"' \
--form 'people_subtitle_es="Conoce al increíble equipo que hace todo posible"'
```

## Language Codes

- **en** - English
- **nl** - Dutch (Nederlands)
- **de** - German (Deutsch)
- **fr** - French (Français)
- **es** - Spanish (Español)

## Sections Included

1. **Banner Section** - Banner image, title, subtitle, button text & link (all 5 languages)
2. **Founder Quote Section** - Quote text, name, designation, note (all 5 languages)
3. **Meet Brains Section** - Title, subtitle, main image (all 5 languages)
4. **Timeline Section** - Section title, description, and 4 timeline events (all 5 languages)
5. **People Section** - Title and subtitle (all 5 languages)

## Notes

- Replace `<YOUR_ADMIN_TOKEN>` with your actual admin JWT token
- Replace `/path/to/banner.jpg` and `/path/to/meet-brains.jpg` with your actual image file paths
- All text fields support all 5 languages (en, nl, de, fr, es)
- Timeline events are indexed (0, 1, 2, 3) - you can add more by incrementing the index
- The order field in timeline events determines the display order
