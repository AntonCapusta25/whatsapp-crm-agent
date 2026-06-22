const fs = require('fs');

const chefList = `1. Adinkra Flavors (Lelystad) — +31684157418
2. Almatbakh Cuisine (Den Haag) — +31687595363
3. Amar Bangla (Almere) — +31616584658
4. Ammi's Kitchen (Rotterdam) — +31685644230
5. Amsterdam Agave 🌵 (Amsterdam) — +31685951555
6. Ann's Shades of Taste (Breda) — +31687837943
7. Armandos' Kitchen (Den Haag) — +31649012602
8. Aroma of Africa Bites (Enschede) — +31685713688
9. Astro Kitchen (Arnhem) — +31616640710
10. ATK Kitchen (Amsterdam) — +31659179643
11. B's African Kitchen (Enschede) — +31685224994
12. Bangaliana (Amsterdam) — +31611957090
13. Beirut Bites (Purmerend) — +31642569986
14. Bites & Gather (Leiden) — +31646337670
15. Bohemian Lotus (Bohemian Lotus) — +31641509315
16. Boka Bakes (—) — +31612538018
17. Bombay Bites (Gouda) — +31687070430
18. Bottega da Dome (Rotterdam) — +31642558507
19. Cali quesadillas (Amsterdam) — +31629595562
20. Canet Paellas (Amsterdam) — +31630853880
21. Clay Handi Kitchen (Den Haag) — +31658918123
22. Comal & cacao (Delft) — +31629163653
23. Curry Campus (Enschede) — +31616994229
24. Da Vincenzo (Haarlem) — +31648045826
25. Daawat and Desserts (Amsterdam) — +31627514664
26. Dante's Kitchen (Amsterdam) — +31657826722
27. deKottencake (Enschede) — +31648882102
28. Deshi Taste (Amsterdam) — +31684032238
29. Desi Cravings (Arnhem) — +31685820165
30. Desi Cuisines (Enschede) — +31647528490
31. Dranol Foods (Delft) — +31616271233
32. East African Cuisine (Rotterdam) — +31653354263
33. Eastern Kitchen (Veenendaal) — +31686391834
34. Emy's Kitchen (Den Haag) — +31643163795
35. Fatema's Asian Kitchen (—) — +31616885890
36. Foldo - Italian Classic Piadina (Rotterdam) — +31111111111
37. Fresh Kitchen Delights (Amsterdam) — +31638165919
38. Girly Cakery (Lelystad) — +31625508721
39. Healthy Zaandam Bites (Zaandam) — +31648667301
40. Herbain (Amsterdam) — +31639284734
41. Hibiscuits (Enschede) — +31653456326
42. Il Forno (Amsterdam) — +31647200046
43. Jajan To Go (Maastricht) — +31687374984
44. Jor's Kitchen (Rotterdam) — +31640606328
45. Jourdain Catering (Amsterdam) — +31648161893
46. Kawtar's Moroccan Kitchen (Haarlem) — +31687349794
47. Kitchen of Rissa (Amsterdam) — +31641231153
48. Korean Experience (Amsterdam) — +31634965035
49. KYSM Kitchen (Rotterdam) — +31634621345
50. La Esquina Dominicana (Hengelo) — +31638383229
51. Lekker Indian Kitchen (Amsterdam) — +31683226019
52. Mama Sierra Leone (Wierden) — +31624902048
53. Mama's Kitchen (Amsterdam) — +31684465262
54. Marokkaanse Dari (Den Haag) — +31684545918
55. Miraz Healthy & Meal Prep Kitchen (Den Haag) — +31633614291
56. Mokum Masala (Amsterdam) — +31649559771
57. Moofuel Kitchen (Hilversum) — +31618700061
58. Mum's Bites (Heino) — +31615280986
59. Nala Bakery (Uithoorn) — +31649009114
60. Nayrouz's Middle Eastern Kitchen (Amsterdam) — +31627837547
61. Nishu's Biryani House (Enschede) — +31687944199
62. Nourish Bowl (Den Haag) — +31616554295
63. Olijfhuis (Harderwijk) — +31635666506
64. Parampara Bites and Sweets (Amsterdam) — +31685369041
65. Parisa 's Table (Utrecht) — +31640498500
66. Patel's Keuken (Delft) — +31623519222
67. Pauline's Table (Amsterdam) — +31618672384
68. Proper Food (Haarlem) — +31611066398
69. Renato's Italian Kitchen (Amsterdam) — +31687091654
70. Sahari (Enschede) — +31684448627
71. Sara Wereld (Haarlem) — +31687368041
72. Sham's Kitchen (Almere) — +31685629643
73. Smaak by Dina (Schiedam) — +31641894094
74. Smaak Van Perzie (Hazerswoude-Rijndijk) — +31684522958
75. Spice Hut (Utrecht) — +31642912129
76. Spice Road (Enschede) — +31647205983
77. Sprinkle & Swirl (Den Haag) — +31621379457
78. Stella's Bakes (Helmond) — +31619742193
79. Swetima's Indian Kitchen (Amsterdam) — +31687989112
80. Tante Ivy's Kitchen (Amsterdam) — +31687196711
81. TanteKosh (Utrecht) — +31616067178
82. Teo's (Delft) — +31648227331
83. The Clay Pot Kitchen (Enschede) — +31612957795
84. The Maestro of Meppel (Meppel) — +31684052439
85. The Spices of India (Zaandam) — +31644282817
86. Tiffin and Treats (Enschede) — +31616961573
87. Tim Biryani (Haarlem) — +31687394951
88. Tiramisusiss (Enschede) — +31618471295
89. Toetie (Haren) — +31612405483
90. Turkuaz Keuken (Amsterdam) — +31685625817
91. Visit Ghana Cuisine (Amsterdam) — +31684968871
92. Xóm Kitchen (—) — +31616177213
93. Zaza Cucina (Rotterdam) — +31638556205
94. ZQ Eats (Almelo) — +31657238396`;

const message = `Hey, this is Oleksandr from Homemade.

We just updated our new marketing system for chefs and we’re testing it first with a small group of our most active chefs.

The system can help you create marketing creatives, captions, engaging posts, storytelling content, and even upload videos directly to your Instagram. The goal is to make your marketing easier and help you attract more customers with less effort.

Could you please test it here and let us know how it goes?

https://marketing.homemadechefs.com

Your feedback will really help us improve it and make it more useful for you. Also, if you have any questions, even very small ones, just message me or call me anytime and I’ll help you.

Thanks, and please let me know once you’ve tried it.`;

const phones = ['+31687196711'];
console.log(`Extracted ${phones.length} phone numbers (Test mode).`);

async function sendCampaign() {
    try {
        const response = await fetch('http://127.0.0.1:3005/api/default/campaign/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer supabase_secret_token_12345'
            },
            body: JSON.stringify({ phones, message })
        });
        const result = await response.json();
        console.log('Response:', result);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

sendCampaign();
