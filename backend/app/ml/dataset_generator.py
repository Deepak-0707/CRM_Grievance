"""
Synthetic Dataset Generator for CivicTrust Department Classification.
Generates exactly 1,000 realistic, domain-rich citizen grievance reports
balanced across the 7 civic government departments.
"""

import json
import random
import os
from typing import List, Dict

DEPARTMENTS = [
    {
        "code": "PWD",
        "name": "Public Works Department",
        "category": "INFRASTRUCTURE_DAMAGE",
        "topics": [
            "deep pothole cluster on {road}",
            "sinkhole forming beside storm culvert near {landmark}",
            "damaged expansion joint on {flyover}",
            "collapsed concrete pedestrian pavement along {road}",
            "broken concrete median divider causing accident hazard on {road}",
            "road asphalt completely washed away after heavy rain near {landmark}",
            "broken pedestrian foot overbridge metal railing at {junction}",
            "unpaved bumpy crater-filled bypass road near {colony}",
            "uncovered open stormwater drain along main road near {landmark}",
            "sunken sewer manhole collar on fast lane of {road}",
            "cave-in of road shoulder near underpass at {junction}",
            "waterlogging caused by improper road slope and blocked culvert on {road}"
        ],
        "descriptions": [
            "There are multiple deep and dangerous potholes along {road}. Commuters on two-wheelers are swerving sharply to avoid tire blowouts, leading to several minor accidents last evening. Urgent asphalt patch-up and leveling is required before monsoon showers worsen the road surface.",
            "A dangerous sinkhole of nearly four feet depth has opened up right next to the culvert masonry near {landmark}. Traffic police have placed temporary cones, but heavy trucks passing through {colony} risk causing a total collapse of the road shoulder. Immediate PWD civil inspection and reinforced filling needed.",
            "The metallic expansion joint on {flyover} has cracked and shifted out of alignment. Cars experience heavy thuds and steering vibration when crossing at standard speed. If left unattended, structural failure could occur during rush hour.",
            "Pedestrian footpath along {road} is completely broken with shattered concrete slabs and exposed iron rebar. Elderly pedestrians and school children are forced to walk on the busy motor carriageway amidst fast traffic.",
            "The central road median divider opposite {landmark} was struck by a vehicle and concrete blocks are scattered across the right lane. It has become a severe collision hazard especially at night due to lack of reflective hazard markers.",
            "Waterlogging and soil erosion have eroded the asphalt base along the service lane of {road}. Pavement is crumbling into gravel and creating heavy dust, causing frequent skidding for two-wheelers.",
            "The steel handrail of the pedestrian foot overbridge near {junction} is corroded and snapped open. Pedestrians crossing over the express railway and highway tracks are at acute risk of falling.",
            "Road resurfacing work completed last month on {road} is already peeling off into loose stones. Contractor has used sub-standard tar and gravel mixture without proper bitumen compaction.",
            "A gaping open storm water trench remains unbarricaded beside {landmark}. During rains the trench gets completely submerged in puddle water, posing a fatal trap for unsuspecting passersby.",
            "The road underpass near {junction} has developed major ceiling cracks and leaking joints, leading to concrete fragments falling onto passing windshields."
        ]
    },
    {
        "code": "WATER",
        "name": "Water Supply & Sewerage Board",
        "category": "SERVICE_FAILURE",
        "topics": [
            "foul smelling discolored tap water in {colony}",
            "underground water supply main burst spewing drinking water on {road}",
            "sewage line overflow and backflow into residential ground floor at {colony}",
            "severely low piped water pressure in {colony} for over a week",
            "blocked sewer main causing toxic black water stagnation near {landmark}",
            "contaminated drinking water supply causing acute gastroenteritis in {colony}",
            "broken sluice valve leaking thousands of liters per hour at {junction}",
            "overflowing sewage manhole spilling onto main street of {colony}",
            "unannounced total drinking water supply cut in block {sector}",
            "cross-contamination between drinking water pipe and sewage drain in {colony}"
        ],
        "descriptions": [
            "For the past four days, the municipal tap water supplied to households in {colony} is yellow-brown and emits a pungent sewer odor. Several families have fallen ill with stomach cramps and diarrhea. We suspect an underground pipeline breach.",
            "A high-pressure underground water distribution main has ruptured near {landmark}. Potable clean water is gushing out onto {road}, creating a knee-deep flood while residential taps in the entire sector have run completely dry.",
            "The domestic sewage network in {colony} has backed up. Dirty black sewer water is bubbling out of inspection chambers and back-siphoning into ground-floor bathrooms and courtyards, creating an unbearable stench and health hazard.",
            "Residents of {colony} are receiving municipal water supply for barely 15 minutes a day at extremely weak trickle pressure. Booster pumps are sucking only air and silt. Water tankers are charging exorbitant rates.",
            "The main drainage trunk line near {junction} is choked with silt and sludge. Toxic wastewater has overflowed onto the open road, making it impossible for pedestrians to reach local shops without stepping into raw sewage.",
            "Drinking water pipeline laid parallel to the stormwater nullah near {colony} appears to have fractured. Tap water tested positive for high coliform bacteria and turbidity. Urgent water sample collection and repair needed.",
            "An underground sewer manhole has dislodged its iron lid and is spewing raw sewage onto {road}. Stench is entering surrounding houses and children cannot walk to school safely.",
            "No tap water has been released in {sector} since Tuesday morning without any prior circular from the water board. The overhead community reservoir appears completely depleted."
        ]
    },
    {
        "code": "ELEC",
        "name": "State Electricity Distribution",
        "category": "INFRASTRUCTURE_DAMAGE",
        "topics": [
            "sparking high-voltage distribution transformer near {landmark}",
            "dangling live electricity cable hanging low across {road}",
            "frequent unscheduled power cuts and voltage fluctuations in {colony}",
            "blown transformer leaving entire block of {colony} in darkness",
            "burnt electrical feeder pillar with exposed live copper busbars at {junction}",
            "faulty smart electricity meter recording inflated units in {colony}",
            "complete streetlight blackout across entire residential stretch of {road}",
            "high-voltage power surge burning home appliances in {sector}",
            "leaning electricity pole on verge of collapsing onto houses in {colony}",
            "uncovered street feeder box sparking during evening drizzle near {landmark}"
        ],
        "descriptions": [
            "The 400 KVA step-down transformer installed on the pole structure near {landmark} is buzzing violently with continuous blue electrical sparks and smoke. Oil is dripping from the radiator tank onto the footpath below.",
            "A high-tension overhead cable has snapped and is dangling less than six feet above {road}. Pedestrians and cyclists are narrowly avoiding accidental electrocution. Immediate line isolation and re-stringing required.",
            "Residents of {colony} have been suffering from frequent unannounced power outages lasting 4 to 6 hours daily. Extreme voltage drops down to 140V are tripping air conditioners and water pumps.",
            "A catastrophic voltage surge occurred yesterday evening in {sector}. More than thirty households reported burnt refrigerators, LED televisions, and inverter units due to sudden neutral line failure on the street transformer.",
            "All streetlights along a 1.5 km stretch of {road} have remained pitch black for the past week. Commuters and female pedestrians feel highly unsafe, and two snatching incidents have already occurred.",
            "The street distribution pillar box at {junction} has lost its front metal door. Live 415V three-phase busbars and fuse units are fully exposed to open rain and stray animals.",
            "The concrete electricity pole opposite house #42 in {colony} has cracked at the foundation and is leaning at a precarious 30-degree angle over parked vehicles.",
            "Electronic electricity meter #EL-9942 was replaced last month and is advancing at triple the normal speed despite identical consumption. The power discom inspection crew has ignored multiple written complaints."
        ]
    },
    {
        "code": "MC",
        "name": "Municipal Corporation",
        "category": "SERVICE_FAILURE",
        "topics": [
            "massive overflowing garbage dump rotting on street corner in {colony}",
            "aggressive stray dog pack chasing two-wheelers and biting pedestrians in {colony}",
            "unauthorized construction debris (malba) dumped on green belt along {road}",
            "unhygienic choked open drain overflowing with plastic waste near {landmark}",
            "broken swings, damaged walking track, and tall weeds in community park at {colony}",
            "illegal commercial street encroachment blocking public footpath near {junction}",
            "dead animal carcass lying unattended for two days near {landmark}",
            "hazardous open burning of dry leaves and plastic trash in municipal dump yard at {colony}",
            "lack of daily door-to-door solid waste collection in block {sector}",
            "unauthorized giant commercial billboard erected without safety structural stability certificate"
        ],
        "descriptions": [
            "The open community garbage vat situated on the corner of {road} has not been cleared by municipal tipper trucks for the last six days. Rotting organic waste has spilled onto half the road, attracting swarms of flies and cows.",
            "A pack of 8-10 aggressive stray dogs has colonized the intersection near {landmark}. They have bitten three delivery riders and constantly chase children cycling inside {colony}. Municipal animal birth control (ABC) van needed immediately.",
            "Unidentified commercial building contractors have illegally dumped multiple truckloads of concrete rubble and construction debris directly onto the public green belt adjacent to {road}, destroying saplings and blocking the footpath.",
            "The community recreational park in {colony} is in a state of severe neglect. Children's metal swings are broken with jagged rusted edges, security gates are missing, and overgrown thorny bushes have become a haven for antisocial elements.",
            "Vegetable vendors and shopkeepers have illegally extended permanent iron counters covering the entire pedestrian pavement near {junction}, forcing thousands of daily commuters to walk on the dangerous motor road.",
            "Sanitation sweepers have not visited {colony} for over a fortnight. Dry dust, plastic wrappers, and fallen tree leaves are choking rain gutters and creating filthy conditions.",
            "A dead stray animal carcass has been lying on the road divider near {landmark} for over 48 hours. The decomposition smell has made it unbearable for residents and shopkeepers nearby.",
            "Sanitation staff are setting fire to piles of mixed municipal plastic waste and foliage in {colony} instead of loading them onto transport trucks, releasing toxic dense acrid smoke that is choking asthmatic residents."
        ]
    },
    {
        "code": "TRANS",
        "name": "Metropolitan Transport Authority",
        "category": "DELAYED_PUBLIC_SERVICE",
        "topics": [
            "city bus route {bus_route} skipping scheduled stop at {junction}",
            "rash and reckless high-speed driving by bus driver on route {bus_route}",
            "broken bus shelter roof and missing route arrival display at {junction}",
            "rude bus conductor refusing electronic transit card and demanding cash on route {bus_route}",
            "severe overcrowding and 50-minute bus delays on route {bus_route} during peak hours",
            "defective automated ticketing gate at {metro_station} Metro Station deducting double fare",
            "non-functional air conditioning and sealed windows in low-floor electric bus on route {bus_route}",
            "irregular feeder bus frequency between {metro_station} and residential sectors of {colony}",
            "electric city bus breaking down in middle of busy flyover causing huge traffic gridlock",
            "lack of wheelchair ramp deployment and inaccessible boarding for disabled passenger at {junction}"
        ],
        "descriptions": [
            "City bus operating on route {bus_route} deliberately fails to pull into the designated passenger bay at {junction} during morning rush hours. Drivers speed in the center lane and ignore waiting students and elderly commuters.",
            "The driver of city transit bus vehicle #DL-01-TC-4412 on route {bus_route} was driving recklessly, tailgating private cars, jumping red signals, and braking abruptly, causing several standing passengers to fall and bruise themselves.",
            "The passenger bus shelter at {junction} has completely lost its corrugated roof sheets. Commuters waiting for buses are left exposed to direct scorching sun and heavy rain. The electronic arrival timetable screen has been blank for months.",
            "Conductor on route {bus_route} repeatedly claims the digital ticketing machine is offline and forces commuters to pay in cash without issuing an official paper ticket, pocketing the government transit revenue.",
            "There are severe frequency gaps of over 50 minutes on route {bus_route} connecting {colony} to {metro_station}. When a bus finally arrives, it is dangerously packed beyond safety capacity with people hanging on footboards.",
            "Automated fare collection gate #4 at {metro_station} Metro Station deducted double journey fare from my smart travel card while failing to open the flap barrier. Station customer service supervisor refused to refund the deducted amount.",
            "The public transit feeder bus fleet operating between {colony} and {metro_station} has cut service down to two sporadic trips per evening, leaving office commuters stranded at the station without last-mile connectivity."
        ]
    },
    {
        "code": "HEALTH",
        "name": "Public Health Services",
        "category": "SERVICE_FAILURE",
        "topics": [
            "primary health dispensary in {colony} found locked during working hours",
            "acute shortage of anti-rabies vaccine and basic bandages at {hospital}",
            "urgent anti-mosquito fogging required due to surging dengue and chikungunya cases in {colony}",
            "unhygienic condition of emergency casualty ward and dirty mattresses at {hospital}",
            "duty medical officer absent from casualty department during night shift at {hospital}",
            "dispensing expired antibiotic syrups to pediatric patients at government clinic in {colony}",
            "breakdown of ultrasound and X-ray imaging machine for three weeks at {hospital}",
            "unattended biomedical waste bags dumped in open hospital compound near {hospital}",
            "denial of free diagnostic blood tests to subsidized cardholders at {hospital}",
            "overcharging for mandatory ambulance transfer service from {hospital}"
        ],
        "descriptions": [
            "The government Primary Urban Health Centre in {colony} was locked shut yesterday at 11:30 AM during official clinic working hours. Dozens of expectant mothers and elderly diabetic patients were turned away without medicines.",
            "A citizen bitten by a stray animal was rushed to {hospital} emergency wing, only to be informed that anti-rabies immunization vials and tetanus toxoid are completely out of stock. Patients are being forced to purchase expensive private pharmacy drugs.",
            "More than fifteen confirmed cases of dengue fever and vector-borne malaria have been reported in {colony} over the past ten days. Stagnant rainwater puddles have become mosquito breeding havens. Public health department must dispatch insecticidal thermal fogging teams immediately.",
            "The sanitary conditions in the female inpatient ward of {hospital} are deplorable. Dustbins are overflowing with used cotton dressings, bathroom taps are dry, and bed sheets have not been replaced for days.",
            "The automated biochemistry analyzer and digital X-ray machine at {hospital} have been non-functional for nearly a month. Economically underprivileged patients are being redirected to private commercial diagnostic labs.",
            "Bio-medical hazardous waste including used disposable syringes, saline tubes, and blood-stained surgical gauze are being dumped into open municipal dumpsters behind {hospital} instead of biohazard incinerator bins.",
            "The doctor posted for afternoon OPD duty at {colony} municipal dispensary routinely arrives two hours late and leaves within 30 minutes, turning away patients who traveled long distances on foot."
        ]
    },
    {
        "code": "EDU",
        "name": "Directorate of School Education",
        "category": "SERVICE_FAILURE",
        "topics": [
            "substandard and unhygienic mid-day meal served at Government School {colony}",
            "cracked roof ceiling plaster peeling off dangerously in primary classroom of {school}",
            "complete lack of functional separate washrooms for female students at {school}",
            "chronic absenteeism of senior secondary mathematics teacher at {school}",
            "broken wooden benches forcing primary students to sit on cold damp floors at {school}",
            "unpotable drinking water from rusted water tank causing stomach infections at {school}",
            "non-distribution of free academic textbooks and uniform grants at {school}",
            "boundary wall collapsed allowing stray animals to enter playground of {school}",
            "non-functional science laboratory and missing experimental apparatus at {school}",
            "fire extinguisher cylinders expired and missing emergency evacuation exits at {school}"
        ],
        "descriptions": [
            "The mid-day meal served yesterday to children at Government Senior Secondary School {colony} was foul smelling and contained insects in the lentil curry. Several students vomited after eating. Immediate quality inspection of the central catering kitchen is necessary.",
            "The concrete ceiling in Class 4-B of {school} has developed severe water seepage cracks. Yesterday a large chunk of concrete plaster collapsed onto an empty front desk. Continuing classes in this room is a life-threatening hazard for children.",
            "The government girls high school at {colony} does not have a single functional, clean toilet with running water. Doors lack latches and drainage is completely blocked, leading to high female student absenteeism and dropouts.",
            "The designated mathematics and science teacher at {school} has been absent for six consecutive weeks without any substitute arrangement. Board exam syllabus remains entirely untaught.",
            "More than eighty students in Class 6 and 7 at {school} are forced to sit on uncarpeted damp cement floors in freezing weather because over 40 dual-desks are broken with shattered wooden planks.",
            "The overhead drinking water storage tank at {school} has not been descaled or bleached for over two years. The water coming from water cooler taps contains rust flakes and foul sludge, causing jaundice in two school children.",
            "Students of Class 8 at {school} have still not received their sanctioned NCERT syllabus textbooks three months into the academic session, severely impacting their academic term preparation.",
            "The perimeter boundary wall of Government Boys School {colony} collapsed during the monsoon and has not been repaired. Stray cattle and street dogs freely enter the school compound during sports recess."
        ]
    }
]

LOCATIONS = {
    "road": [
        "Ring Road near Moolchand Underpass", "Mathura Road Sector 15 Junction", "MG Road Cyber Corridor",
        "Outer Ring Service Road near Sector 14", "Mehrauli-Badarpur Expressway", "Najafgarh Main Arterial Highway",
        "Vikas Marg near Laxmi Nagar Metro", "GT Karnal Bypass Road", "Rohtak Road Industrial Area",
        "Dwarka Link Road Expressway", "Patparganj Industrial Area Main Road", "Lodhi Road Flyover Descent"
    ],
    "landmark": [
        "Sector 14 Central Market", "Apollo Hospital Crossing", "District Court Complex Gate 3",
        "Metro Pillar #284", "Govt Senior Secondary School Gate", "Old Subzi Mandi Chowk",
        "Community Health Centre", "Ward 12 Municipal Office", "State Bus Depot Terminal",
        "Railway Overbridge PWD Depot", "District Sports Stadium", "B-Block Shopping Arcade"
    ],
    "flyover": [
        "AIIMS Flyover South Ramp", "Sarai Kale Khan Elevated Corridor", "Mayur Vihar Phase 1 Flyover",
        "Dhaula Kuan Grade Separator", "Barapullah Elevated Expressway", "Punjabi Bagh Club Road Flyover",
        "Seelampur Flyover North Descent", "Nehru Place Elevated Section"
    ],
    "junction": [
        "Sector 18 Commercial Intersection", "Peeragarhi Red Light Junction", "ITO Crossroad Signal",
        "Kashmere Gate ISBT Junction", "Ashram Chowk Intersection", "Madhu Vihar T-Point",
        "Shadipur Depot Crossing", "Uttam Nagar East Intersection", "Karkardooma Court Roundabout"
    ],
    "colony": [
        "Rohini Sector 16", "Janakpuri C-Block", "Lajpat Nagar IV", "Dwarka Sector 9 Pocket B",
        "Mayur Vihar Phase 2", "Pitampura Block KP", "Paschim Vihar Outer Ward", "Vasant Kunj Sector C",
        "Shahdara East Extension", "Saket Block J", "Model Town Phase 3", "Malviya Nagar Shivalik Enclave"
    ],
    "sector": [
        "Sector 4 Pocket 1", "Sector 11 Block D", "Sector 22 Market Cluster", "Sector 7 Ext",
        "Sector 19 Phase 2", "Sector 3 Block C", "Sector 14 Residential Enclave"
    ],
    "bus_route": [
        "419", "534", "764", "OMS (+)", "GL-22", "813", "340", "926", "211", "544"
    ],
    "metro_station": [
        "Rajiv Chowk", "Hauz Khas", "Noida City Centre", "Kashmere Gate", "Botanical Garden",
        "Janakpuri West", "Inderlok", "Lajpat Nagar", "Netaji Subhash Place", "Kalkaji Mandir"
    ],
    "hospital": [
        "Ward General Civil Hospital", "Sanjay Gandhi Memorial Hospital", "Babu Jagjivan Ram Memorial Hospital",
        "Deen Dayal Upadhyay Hospital", "Lal Bahadur Shastri Hospital", "Guru Teg Bahadur Hospital",
        "Dr. Baba Saheb Ambedkar Hospital"
    ],
    "school": [
        "Government Boys Senior Secondary School", "Sarvodaya Kanya Vidyalaya",
        "Govt Model Co-Ed Senior Secondary School", "Municipal Primary School Ward 9",
        "Govt Composite Pratibha Vikas Vidyalaya"
    ]
}

DISTRICTS = [
    "South-East Metro Zone", "Eastern Suburban Sector", "North Ward Central",
    "Western Residential Corridor", "South Metro Administrative Zone", "Central Capital District",
    "North-West Sub-City", "South-West Urban Sector"
]

def format_text(template: str) -> str:
    res = template
    for key, vals in LOCATIONS.items():
        placeholder = "{" + key + "}"
        while placeholder in res:
            res = res.replace(placeholder, random.choice(vals), 1)
    return res

def generate_1000_records() -> List[Dict]:
    """Generates 1,000 synthetic grievance records across 7 departments."""
    random.seed(42)  # For reproducible dataset generation
    records = []
    
    # Calculate distribution: 143 for first 5, 142 for remaining 2 (Total = 1000)
    dept_counts = [143, 143, 143, 143, 143, 142, 143]
    record_id_counter = 1001

    for dept_idx, dept in enumerate(DEPARTMENTS):
        target_count = dept_counts[dept_idx]
        dept_topics = dept["topics"]
        dept_descriptions = dept["descriptions"]

        for i in range(target_count):
            topic_idx = i % len(dept_topics)
            desc_idx = (i + (i // len(dept_topics))) % len(dept_descriptions)
            topic_template = dept_topics[topic_idx]
            desc_template = dept_descriptions[desc_idx]

            raw_topic = format_text(topic_template)
            raw_desc = format_text(desc_template)

            # Some real complaints mention a second civic issue. Keep the
            # primary department label, but add a cross-department clue so
            # the classifier sees realistic overlap instead of clean templates.
            if random.random() < 0.20:
                other_departments = [item for item in DEPARTMENTS if item["code"] != dept["code"]]
                other_dept = random.choice(other_departments)
                related_issue = format_text(random.choice(other_dept["topics"]))
                raw_desc += f" Residents also mention {related_issue} as part of the same report."

            # Formulate Title (Title case)
            title = raw_topic[0].upper() + raw_topic[1:]
            district = DISTRICTS[(record_id_counter + i) % len(DISTRICTS)]
            year = 2026

            record = {
                "id": f"SYN-{year}-{record_id_counter:04d}",
                "title": title,
                "description": raw_desc,
                "department_code": dept["code"],
                "scenario_group": f"{dept['code']}:topic-{topic_idx}",
                "department_name": dept["name"],
                "category": dept["category"],
                "district": district,
                "state": "National Capital Region"
            }
            records.append(record)
            record_id_counter += 1

    random.shuffle(records)
    return records

def save_dataset(records: List[Dict], output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, "synthetic_complaints_1000.json")
    csv_path = os.path.join(output_dir, "synthetic_complaints_1000.csv")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    # Save CSV
    import csv
    if records:
        keys = list(records[0].keys())
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)

    print(f"[Dataset Generator] Successfully generated {len(records)} records.")
    print(f"[Dataset Generator] Saved JSON: {json_path}")
    print(f"[Dataset Generator] Saved CSV:  {csv_path}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(current_dir, "data")
    dataset = generate_1000_records()
    save_dataset(dataset, data_dir)
