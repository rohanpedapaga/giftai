# backend/app/services/ai_service.py
# This service handles AI message generation using the Google Gemini API.
# It implements a multi-model backup chain, relationship groups, and permutation fallbacks.

import os
import random
import re
import google.generativeai as genai
from flask import current_app

# Model names list for backup loop in case the primary model is rate-limited on the free tier.
MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
]

# Relationship-specific sentence pairs grouped by Relationship Group and Tone.
# Guaranteed to directly reflect the relationship/bond (at least 2 sentences).
RELATIONSHIP_SENTENCES = {
    # 1. ROMANTIC
    "Romantic_Warm": [
        ["You are my beloved partner and my absolute soulmate.", "Sharing this beautiful journey of life with you is my greatest joy."],
        ["Every single day spent with you is a gift that I cherish deeply.", "Your endless love, warmth, and laughter fill our home with happiness."]
    ],
    "Romantic_Formal": [
        ["I value our mutual commitment and the deep respect we share in our partnership.", "Your graceful presence in my life is a source of constant encouragement."]
    ],
    "Romantic_Funny": [
        ["You are my partner in crime and the only one who tolerates my craziness.", "Here is to another year of putting up with my jokes and antics together."]
    ],
    "Romantic_Heartfelt": [
        ["You mean the absolute world to me, and my love for you grows stronger each day.", "Thank you for being my anchor, my confidant, and my truest companion."]
    ],
    "Romantic_Professional": [
        ["I value the respect and professional dedication we maintain in our partnership.", "Your support and mutual understanding are key to our shared path."]
    ],
    "Romantic_Inspirational": [
        ["Our relationship has shown me the true power of trust, growth, and shared dreams.", "I am constantly motivated by your strength, kindness, and support."]
    ],

    # 2. GRANDPA
    "Grandpa_Warm": [
        ["Your wisdom, warm presence, and wonderful stories always bring our family closer.", "I cherish all the wonderful family memories and guidance you have given me."]
    ],
    "Grandpa_Formal": [
        ["I want to express my highest respect and admiration for your lifetime of wisdom.", "Your exemplary character and guidance are deeply valued by our family."]
    ],
    "Grandpa_Funny": [
        ["Thanks for always having the best stories and letting me get away with things my parents wouldn't.", "They say wisdom comes with age, and you must be the wisest person I know."]
    ],
    "Grandpa_Heartfelt": [
        ["I am deeply grateful for your lifelong wisdom, guidance, and unconditional love.", "Your presence is a true blessing, and I hold our family bond close to my heart."]
    ],
    "Grandpa_Professional": [
        ["I deeply respect the legacy of hard work, integrity, and dedication you represent.", "Your guidance has set an outstanding example for generations to follow."]
    ],
    "Grandpa_Inspirational": [
        ["Your life journey, resilience, and wisdom serve as a constant source of inspiration to me.", "You show us what it means to lead a life of purpose, honor, and strength."]
    ],

    # 3. GRANDMA
    "Grandma_Warm": [
        ["Your warm hugs, kind heart, and gentle nature bring so much joy to our family.", "I am incredibly grateful for all the love and happiness you share with us."]
    ],
    "Grandma_Formal": [
        ["Please accept my deepest respect and gratitude for the grace and love you bring to our family.", "Your guidance and steadfast care are an admirable example for us all."]
    ],
    "Grandma_Funny": [
        ["Thanks for always spoiling me and cooking the absolute best family meals.", "I'm convinced you have a secret recipe for happiness and endless patience."]
    ],
    "Grandma_Heartfelt": [
        ["Your endless affection, kindness, and family love fill my heart with deep gratitude.", "Thank you for always being a source of comfort, reassurance, and pure love."]
    ],
    "Grandma_Professional": [
        ["I value your lifetime of dedication, grace, and the strong family values you uphold.", "Your wisdom and presence continue to be highly respected by everyone."]
    ],
    "Grandma_Inspirational": [
        ["Your strength, resilience, and positive spirit inspire me to be a better person daily.", "You show our family the true beauty of kindness, patience, and unconditional love."]
    ],

    # 4. UNCLE / AUNT
    "Uncle_Warm": [
        ["Having you in my life brings so much warm support, laughter, and family connection.", "I cherish all the fun times and meaningful advice we have shared over the years."]
    ],
    "Uncle_Formal": [
        ["I highly value our family connection and want to express my sincere appreciation.", "Your guidance and support on this milestone are very meaningful to me."]
    ],
    "Uncle_Funny": [
        ["Thanks for being the cool relative who always knows how to keep things fun.", "Let's celebrate this occasion and show the rest of the family how it's done."]
    ],
    "Uncle_Heartfelt": [
        ["Your genuine connection, warmth, and constant encouragement mean the world to me.", "I am deeply grateful for your presence in my life and our close family bond."]
    ],
    "Uncle_Professional": [
        ["I appreciate the professional advice, guidance, and respect we share.", "Your support represents an admirable standard of cooperation and integrity."]
    ],
    "Uncle_Inspirational": [
        ["Your positive attitude, advice, and career achievements inspire me to aim higher.", "Thank you for always encouraging my potential and supporting my growth."]
    ],

    # 5. BROTHER / SISTER / SIBLING
    "BrotherSister_Warm": [
        ["I am so grateful for our sibling bond and all the support we share.", "Thank you for always being a source of comfort, reassurance, and love."]
    ],
    "BrotherSister_Formal": [
        ["I value our sibling connection and the heritage of family values we share.", "Please accept my sincere appreciation and best wishes on this occasion."]
    ],
    "BrotherSister_Funny": [
        ["Thanks for sharing the same weird genes and sense of humor as me.", "Let's celebrate before we get any older and forget why we are here."]
    ],
    "BrotherSister_Heartfelt": [
        ["Our shared memories and deep emotional bond mean more to me than words can express.", "No matter where life takes us, I am so proud to call you my sibling."]
    ],
    "BrotherSister_Professional": [
        ["I highly value the mutual respect, professional support, and trust we share.", "It is wonderful to witness your accomplishments and share in this success."]
    ],
    "BrotherSister_Inspirational": [
        ["Your strength, resilience, and positive attitude have always inspired me.", "You show me what dedication, courage, and unconditional support look like."]
    ],

    # 6. TEACHER
    "Teacher_Warm": [
        ["I am so grateful for your warm guidance, encouragement, and patience.", "Your support has made a significant and positive difference in my learning journey."]
    ],
    "Teacher_Formal": [
        ["I want to express my deepest respect and gratitude for your academic guidance.", "Your dedication to education serves as an admirable example to all students."]
    ],
    "Teacher_Funny": [
        ["Thanks for teaching me so much, and for not grading my jokes too harshly.", "I promise to put the knowledge to use, or at least try my best."]
    ],
    "Teacher_Heartfelt": [
        ["Your wisdom, encouragement, and guidance have truly shaped my life and goals.", "I will always be deeply grateful for your mentorship and belief in my potential."]
    ],
    "Teacher_Professional": [
        ["I highly value your professional instruction, guidance, and educational support.", "Thank you for your commitment to excellence and professional academic mentorship."]
    ],
    "Teacher_Inspirational": [
        ["Your passion for teaching and belief in growth inspire me to strive for excellence.", "You have motivated me to look at challenges as opportunities to learn and succeed."]
    ],

    # 7. BOSS
    "Boss_Warm": [
        ["Working under your guidance is a pleasure, and I appreciate your warm support.", "Your positive leadership makes our professional projects much more enjoyable."]
    ],
    "Boss_Formal": [
        ["I highly value your professional guidance and the leadership you provide.", "Your dedication to our team's success is a source of constant encouragement."]
    ],
    "Boss_Funny": [
        ["Thanks for being a boss who doesn't micromanage and lets us get things done.", "Here is to hoping this card is better than another endless email thread."]
    ],
    "Boss_Heartfelt": [
        ["I am deeply grateful for your sincere mentorship, support, and professional belief in me.", "Your guidance has made a profound and lasting impact on my career growth."]
    ],
    "Boss_Professional": [
        ["I appreciate your professional direction, support, and commitment to excellence.", "Thank you for your cooperative leadership and the standards you maintain."]
    ],
    "Boss_Inspirational": [
        ["Your professional vision, integrity, and dedication inspire our entire team.", "Your leadership encourages us to innovate, collaborate, and reach new heights."]
    ],

    # 8. FAMILIAL - General Fallback (Mom, Dad, etc.)
    "Familial_Warm": [
        ["Family means everything, and having you in my life is a blessing.", "Your constant care, guidance, and affection make our home a warm place."]
    ],
    "Familial_Formal": [
        ["I want to express my deepest respect and gratitude for your role in our family.", "Your guidance, integrity, and wisdom serve as an admirable example to us all."]
    ],
    "Familial_Funny": [
        ["They say you can't choose your family, but I'm glad we ended up together.", "Thanks for always keeping my secrets and laughing at our family drama."]
    ],
    "Familial_Heartfelt": [
        ["I am deeply grateful for our close family connection and unconditional support.", "Your presence in my life brings so much genuine happiness and peace to my heart."]
    ],
    "Familial_Professional": [
        ["I value our family connection and the respect we maintain in all endeavors.", "Thank you for your reliable guidance, support, and dedication to our family."]
    ],
    "Familial_Inspirational": [
        ["Your strength, resilience, and positive attitude have always inspired me.", "Thank you for encouraging me to reach for my dreams and grow stronger."]
    ],

    # 9. FRIENDLY - General Fallback
    "Friendly_Warm": [
        ["Having you in my life is a true blessing that I never take for granted.", "Thank you for always being someone I can trust and talk to anytime."]
    ],
    "Friendly_Formal": [
        ["I appreciate your thoughtful support and the value of our connection.", "Wishing you continued health, happiness, and peace in all your pursuits."]
    ],
    "Friendly_Funny": [
        ["I'm glad we are connected, mostly because I don't have to dress up around you.", "Let's celebrate today and eat way too much cake together."]
    ],
    "Friendly_Heartfelt": [
        ["Your kindness, support, and genuine nature mean more to me than words can express.", "Thank you for being such a sincere, caring, and valued presence in my life."]
    ],
    "Friendly_Professional": [
        ["I highly value our relationship and the positive cooperation we share.", "Please accept my best wishes for your continued success and prosperity."]
    ],
    "Friendly_Inspirational": [
        ["Your positive energy and resilient attitude are a great source of motivation.", "You show everyone what true dedication and genuine kindness look like."]
    ],

    # 10. PROFESSIONAL - Fallback
    "Professional_Warm": [
        ["Working alongside you is a pleasure, and I appreciate your warm support.", "Your positive energy makes every professional project much more enjoyable."]
    ],
    "Professional_Formal": [
        ["I highly value our professional relationship and the collaboration we share.", "Your dedication and high standards of work are vital to our success."]
    ],
    "Professional_Funny": [
        ["Thanks for working hard so I don't look like the only lazy one here.", "Let's celebrate this occasion and take a well-deserved coffee break."]
    ],
    "Professional_Heartfelt": [
        ["I am deeply grateful for our professional partnership and mutual support.", "Thank you for always bringing dedication, collaboration, and sincerity to our projects."]
    ],
    "Professional_Professional": [
        ["We appreciate your dedication, professional support, and outstanding contribution.", "Thank you for your commitment to excellence and professional cooperation."]
    ],
    "Professional_Inspirational": [
        ["Your professional vision and integrity serve as a great source of motivation.", "Your dedication to excellence drives our team to achieve our goals daily."]
    ]
}

# Occasion base components: openings, closings, expansions, transitions.
OCCASION_TEMPLATES = {
    "Birthday": {
        "openings": [
            "Wishing you a wonderful birthday, {recipient_name}!",
            "Happy Birthday, {recipient_name}!",
            "Wishing you a fantastic birthday, {recipient_name}!"
        ],
        "closings": [
            "Sending you my warmest thoughts and best wishes for the year ahead.",
            "Have an amazing and unforgettable day!",
            "May the coming year bring you continued health and happiness."
        ],
        "expansions": [
            ["May this new year of your life be filled with new adventures.", "I hope you enjoy every single moment of your celebration today."],
            ["May your birthday be sweet and your celebrations be even sweeter.", "May the upcoming months bring you success and new opportunities."],
            ["I hope you create some beautiful and long-lasting memories today.", "Wishing you peace, abundance, and endless smiles in the days ahead."]
        ],
        "transitions": [
            "You deserve the absolute best today and always because of your kind heart.",
            "Thank you for always bringing so much positivity and light into the world.",
            "Your presence brings so much happiness and reassurance to those around you."
        ]
    },
    "Anniversary": {
        "openings": [
            "Wishing a very happy anniversary to you, {recipient_name}!",
            "Happy Anniversary, {recipient_name}!",
            "Sending warm wishes on your anniversary, {recipient_name}."
        ],
        "closings": [
            "Have a beautiful and memorable anniversary celebration!",
            "Have a delightful and happy anniversary celebration today!",
            "May your love continue to grow stronger and deeper with each passing year."
        ],
        "expansions": [
            ["It is always a joy to witness the beautiful bond you share.", "Wishing you a wonderful celebration filled with laughter and happy memories."],
            ["May your lives be blessed with continued peace, health, and mutual respect.", "Thank you for being such an inspiring example of love and commitment."],
            ["May the years ahead be filled with shared dreams, laughter, and deep affection.", "May you always find comfort, support, and joy in each other's presence."]
        ],
        "transitions": [
            "Sharing these milestones is a wonderful reminder of the strength of our connections.",
            "Your dedication to each other is a beautiful source of inspiration.",
            "Every year spent building shared dreams makes the foundation stronger."
        ]
    },
    "Thank You": {
        "openings": [
            "Thank you so much, {recipient_name}!",
            "I wanted to send a quick note of appreciation to you, {recipient_name}.",
            "Please accept my sincere thanks, {recipient_name}."
        ],
        "closings": [
            "Wishing you a wonderful and happy day ahead!",
            "Sending you my warmest thoughts and deepest appreciation!",
            "Wishing you all the best and a future filled with happiness."
        ],
        "expansions": [
            ["Your kindness and support mean more to me than words can express.", "I really appreciate you taking the time to help me out recently."],
            ["Your positive attitude and helpful suggestions were highly valuable.", "It is such a pleasure to have someone as supportive as you in my circle."],
            ["Your willingness to help out is a wonderful trait that I admire.", "Your thoughtfulness has made a significant and positive impact on my day."]
        ],
        "transitions": [
            "Please know that your assistance was incredibly meaningful to me.",
            "I will always remember and appreciate your incredible generosity.",
            "Your support has made a world of difference during a challenging time."
        ]
    },
    "Corporate Gift": {
        "openings": [
            "Dear {recipient_name}, please accept this gift as a token of our appreciation.",
            "Dear {recipient_name}, thank you for your outstanding professional support.",
            "We highly value our professional relationship with you, {recipient_name}."
        ],
        "closings": [
            "Please accept my best wishes for your continued success.",
            "Wishing you and your organization continued success and prosperity.",
            "Best wishes for all your current and future endeavors."
        ],
        "expansions": [
            ["We highly value the professional collaboration and trust between our organizations.", "Thank you for your outstanding contributions and continued dedication."],
            ["We hope this small gesture conveys our gratitude for your excellent support.", "May our professional relationship continue to grow and prosper in the future."],
            ["We look forward to many more years of successful collaboration and growth.", "We hope this gesture conveys our sincere gratitude for your excellent work."]
        ],
        "transitions": [
            "Your dedication and high standards motivate us to reach new professional heights.",
            "Thank you for your reliable cooperation and the support you extend.",
            "We appreciate your partnership and the consistently high standards you maintain."
        ]
    },
    "Festival": {
        "openings": [
            "Wishing you a beautiful and blessed festive season, {recipient_name}!",
            "Season's greetings to you, {recipient_name}!",
            "Wishing you a happy and blessed festive season, {recipient_name}."
        ],
        "closings": [
            "Have a beautiful, warm, and blessed holiday!",
            "Have an absolutely beautiful and memorable festive celebration today!",
            "Have a delightful and happy holiday!"
        ],
        "expansions": [
            ["May this festive time be filled with warm memories, laughter, and joy.", "I hope your home is blessed with peace, harmony, and happiness today."],
            ["May your holidays be bright, peaceful, and filled with the company of loved ones.", "I hope this festive season brings you a well-deserved time of relaxation."],
            ["May the celebrations bring peace, joy, harmony, and new beginnings to your home.", "I hope you enjoy a wonderful holiday with your family and close friends."]
        ],
        "transitions": [
            "Festive celebrations remind us of the power of sharing, unity, and gratitude.",
            "Thank you for being such a supportive and valued presence throughout the year.",
            "I hope this season of reflection gives you renewed strength and clear vision."
        ]
    }
}

def has_consecutive_words(text, reference, n=4):
    """
    Checks if n or more consecutive words from reference appear in text.
    Both inputs are cleaned: punctuation removed, case normalized, split by whitespace.
    """
    if not text or not reference:
        return False
    def get_words(t):
        cleaned = re.sub(r'[^\w\s]', '', t.lower())
        return cleaned.split()

    text_words = get_words(text)
    ref_words = get_words(reference)
    
    if len(ref_words) < n:
        return False
        
    ref_ngrams = set()
    for i in range(len(ref_words) - n + 1):
        ref_ngrams.add(tuple(ref_words[i:i+n]))
        
    for i in range(len(text_words) - n + 1):
        if tuple(text_words[i:i+n]) in ref_ngrams:
            return True
            
    return False

def get_safe_interpreted_fallback_sentences(extra_note):
    """
    Constructs 3 fallback sentences from the extra_note by extracting key words
    and weaving them into template sentences, ensuring that no 4 consecutive words
    from the original note are copied.
    """
    stopwords = {
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
        'yours', 'him', 'her', 'his', 'hers', 'it', 'its', 'they', 'them', 'their',
        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is',
        'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
        'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or',
        'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
        'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
        'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
        'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'has', 'have', 'had',
        'having', 'he', 'she', 'they', 'we'
    }
    original_words = extra_note.split()
    keywords = []
    for w in original_words:
        cleaned_w = re.sub(r'[^\w\s]', '', w.lower())
        if cleaned_w and cleaned_w not in stopwords:
            keywords.append(w)
            
    if not keywords:
        return [
            "I wanted to share my warmest support for your recent special update.",
            "It is always a joy to celebrate these meaningful moments and news with you.",
            "Wishing you complete success and happiness in this next step of your journey."
        ]
        
    kw = keywords
    
    if len(kw) >= 3:
        s1 = f"I am absolutely thrilled to hear about your latest news regarding {kw[0]} and {kw[1]}."
        s2 = f"This exciting update involving {kw[2]} represents a wonderful new milestone."
        s3 = f"I wish you the absolute best as you focus on these new endeavors and goals."
    elif len(kw) == 2:
        s1 = f"I am so excited to hear about your latest endeavors with {kw[0]}."
        s2 = f"This wonderful news and your focus on {kw[1]} is truly inspiring."
        s3 = f"I wish you complete success and happiness as you embark on this next phase."
    else:  # len(kw) == 1
        s1 = f"I was so delighted to hear the wonderful news regarding {kw[0]}."
        s2 = f"This special achievement marks a truly memorable and proud moment."
        s3 = f"Wishing you all the best as you celebrate this exciting update."
        
    return [s1, s2, s3]

def get_semantic_context_sentences(extra_note, occasion):
    """
    Analyzes the user's Context note and returns exactly 3 sentences that semantically
    relate to the topic (e.g. retirement, graduation, travel, cricket, marathon etc.),
    without copying raw consecutive words.
    """
    if not extra_note or not extra_note.strip():
        return None
        
    note_lower = extra_note.lower().strip()
    
    # 1. Semantic Match Rules (No raw keyword copying)
    if any(k in note_lower for k in ["retir", "pension"]):
        return [
            "Congratulations on your recent retirement and this wonderful milestone in your life.",
            "This special achievement marks the beginning of a new chapter filled with relaxation and freedom.",
            "I hope this next phase of your journey brings you endless peace, happiness, and time to pursue your passions."
        ]
        
    elif any(k in note_lower for k in ["graduat", "degree", "diploma", "college", "university", "school", "study"]):
        return [
            "Congratulations on your graduation and completing this major educational milestone.",
            "Your incredible hard work, late-night studies, and dedication have truly paid off.",
            "I am so proud of your achievement and excited to see the bright future that lies ahead of you."
        ]
        
    elif any(k in note_lower for k in ["bak", "pastr", "cake", "cook", "kitchen", "dessert"]):
        return [
            "I always think of your wonderful baking and the delicious pastries you share with us.",
            "Your passion in the kitchen brings so much sweetness, warmth, and joy to everyone around you.",
            "I hope you continue to find happiness in creating such wonderful treats for the people you love."
        ]
        
    elif any(k in note_lower for k in ["trip", "travel", "vacat", "visit", "holiday", "tour", "explore", "paris", "london"]):
        return [
            "I hope you have an absolutely wonderful trip filled with new adventures and beautiful sights.",
            "Traveling always brings such inspiring perspectives, growth, and memorable experiences.",
            "I cannot wait to hear all about your journey and the stories you bring back."
        ]
        
    elif any(k in note_lower for k in ["job", "career", "promot", "work", "office", "business", "employ"]):
        return [
            "Congratulations on this well-deserved success and major milestone in your professional career.",
            "Your outstanding work ethic, talent, and dedication serve as a true inspiration to everyone.",
            "I wish you continued achievements and complete fulfillment in this exciting new role."
        ]
        
    elif any(k in note_lower for k in ["home", "house", "mov", "apart", "settle", "location"]):
        return [
            "Congratulations on your new home and this exciting new chapter of settling in.",
            "May your new living space be filled with laughter, warmth, and many years of happy memories.",
            "Wishing you all the very best as you make this beautiful house your own."
        ]
        
    elif any(k in note_lower for k in ["cute", "sweet", "adorable", "beautiful"]):
        return [
            "I always cherish the sweet and beautiful moments we share together.",
            "Your kind presence and lovely spirit bring so much warmth to my heart.",
            "I feel incredibly lucky to have someone so special and wonderful in my life."
        ]
        
    elif any(k in note_lower for k in ["baby", "born", "pregn", "child", "infant", "kid"]):
        return [
            "Congratulations on the new addition to your family and this beautiful miracle.",
            "Bringing a new baby into the world is a life-changing journey filled with endless wonder.",
            "Wishing you and your little one a lifetime of good health, love, and happiness."
        ]
        
    elif any(k in note_lower for k in ["wedding", "marry", "marri", "spouse", "bride", "groom"]):
        return [
            "Congratulations on your wedding day and the beginning of your beautiful marriage.",
            "May your love for each other grow deeper, stronger, and more resilient with each passing year.",
            "Wishing you both a lifetime of shared laughter, happiness, and companionship."
        ]

    elif any(k in note_lower for k in ["cricket", "sport", "game", "match", "play", "football", "soccer", "tennis", "basketball", "addict", "fan"]):
        return [
            "It is wonderful to celebrate your great passion for the game and active lifestyle.",
            "Your dedication to sports and team spirit is a true inspiration to all of us.",
            "I hope the coming year brings you many more thrilling matches and memorable victories."
        ]

    elif any(k in note_lower for k in ["marathon", "race", "run", "win", "won", "champion", "medal", "trophy", "compet"]):
        return [
            "Congratulations on your incredible achievement and winning this major competition.",
            "Your dedication, training, and endurance have truly paid off in this remarkable milestone.",
            "I am incredibly proud of your success and look forward to celebrating your future achievements."
        ]
        
    # 2. Safe interpreted fallback context block (never copies 4+ consecutive words)
    return get_safe_interpreted_fallback_sentences(extra_note)

def generate_message_with_ai(prompt, occasion_name, tone_name, recipient_name, relationship, exclude_texts=None, extra_note=None):
    """
    Attempts to generate a greeting message using Groq chat completions API.
    Uses llama-3.3-70b-versatile as primary model, falling back to other Groq models on failure.
    Sets AI temperature to 0.9.
    Checks for Context Safety Rule (consecutive words copying) and auto-regenerates if violated.
    Returns: (message_text, ai_used, debug_info)
    """
    api_key = current_app.config.get('GROQ_API_KEY')

    debug_info = {
        "prompt": prompt,
        "raw_response": None,
        "status": "Initializing...",
        "fallback_used": True,
        "error_logs": []
    }
    
    if not api_key or api_key == "your_groq_api_key_here":
        err_msg = "Groq API key is not configured. Using fallback templates."
        print(err_msg)
        debug_info["status"] = "API Key Missing"
        debug_info["error_logs"].append(err_msg)
        
        debug_info["ai_provider"] = "Groq API"
        debug_info["request_sent"] = f"Prompt: {prompt}\nTemperature: 0.9"
        debug_info["response_status"] = "401 (Unauthorized / Missing API Key)"
        debug_info["error_msg"] = "GROQ_API_KEY environment variable is not set or empty in .env"
        debug_info["fallback_triggered"] = "Yes"
        
        fallback_msg = get_fallback_message(occasion_name, tone_name, recipient_name, relationship, exclude_texts, extra_note)
        return fallback_msg, False, debug_info
        
    models_to_try = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'llama3-70b-8192',
        'llama3-8b-8192'
    ]
    
    import requests
    max_retries_per_model = 2
    last_status_code = "Unknown"
    last_error_message = "No models attempted successfully."
    
    for model_name in models_to_try:
        model_retries = 0
        while model_retries < max_retries_per_model:
            try:
                print(f"Attempting message generation with Groq model: {model_name} (try {model_retries + 1})...")
                debug_info["error_logs"].append(f"Attempting model: {model_name} (try {model_retries + 1})")
                
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.9,
                    "max_tokens": 500
                }
                
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=10.0
                )
                
                status_code = response.status_code
                if status_code != 200:
                    raise Exception(f"HTTP {status_code}: {response.text}")
                    
                res_json = response.json()
                if "choices" in res_json and len(res_json["choices"]) > 0:
                    raw_text = res_json["choices"][0]["message"]["content"]
                    debug_info["raw_response"] = raw_text
                    
                    cleaned_text = raw_text.strip().replace('"', '')
                    lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
                    num_sentences = len(lines)
                    
                    # Verify sentence count constraint strictly (between 5 and 10 sentences)
                    if not (5 <= num_sentences <= 10):
                        err_line_count = f"Model {model_name} returned invalid line/sentence count: {num_sentences}."
                        print(err_line_count)
                        debug_info["error_logs"].append(err_line_count)
                        
                        last_status_code = "400 (Validation Failure)"
                        last_error_message = err_line_count
                        model_retries += 1
                        continue
                        
                    # Verify Context Safety Rule (no 4+ consecutive words copied)
                    if extra_note and extra_note.strip():
                        if has_consecutive_words(cleaned_text, extra_note, n=4):
                            err_safety = f"Context Safety Rule Violated! Raw context copied in generated output: '{cleaned_text}'"
                            print(err_safety)
                            debug_info["error_logs"].append(err_safety)
                            
                            last_status_code = "400 (Validation Failure)"
                            last_error_message = err_safety
                            model_retries += 1
                            continue
                            
                    # Success
                    debug_info["status"] = "Success"
                    debug_info["fallback_used"] = False
                    
                    debug_info["ai_provider"] = "Groq API"
                    debug_info["request_sent"] = f"Prompt: {prompt}\nTemperature: 0.9\nModel: {model_name}"
                    debug_info["response_status"] = "200 (OK)"
                    debug_info["error_msg"] = "None"
                    debug_info["fallback_triggered"] = "No"
                    
                    return '\n'.join(lines), True, debug_info
                else:
                    err_empty = f"Model {model_name} returned an empty response choices list."
                    print(err_empty)
                    debug_info["error_logs"].append(err_empty)
                    
                    last_status_code = "200 (Empty Response)"
                    last_error_message = err_empty
                    model_retries += 1
                    
            except Exception as e:
                # Extract code and status details if possible
                status_code = "Error"
                import re
                match = re.search(r'\b(400|401|403|404|429|500|503|504)\b', str(e))
                if match:
                    status_code = match.group(1)
                    
                status_desc = f"{status_code} (Error)"
                if status_code == "429":
                    status_desc = "429 (Rate Limit / Quota Exceeded)"
                elif status_code == "401":
                    status_desc = "401 (Authentication Failure)"
                elif status_code == "403":
                    status_desc = "403 (Permission Denied / Bad Key)"
                elif status_code == "400":
                    status_desc = "400 (Bad Request / Invalid Argument)"
                elif status_code == "500":
                    status_desc = "500 (Internal Server Error)"
                elif status_code == "503":
                    status_desc = "503 (Service Unavailable)"
                elif status_code == "504":
                    status_desc = "504 (Gateway Timeout)"
                
                last_status_code = status_desc
                last_error_message = str(e)
                
                err_fail = f"Model {model_name} failed: {str(e)}"
                print(err_fail)
                debug_info["error_logs"].append(err_fail)
                # Break inner loop and try next model
                break
                
    err_all_failed = "All Groq API models failed, rate-limited, or violated safety checks. Falling back to templates."
    print(err_all_failed)
    debug_info["status"] = "AI Failed"
    debug_info["error_logs"].append(err_all_failed)
    
    debug_info["ai_provider"] = "Groq API"
    debug_info["request_sent"] = f"Prompt: {prompt}\nTemperature: 0.9\nModels attempted: {', '.join(models_to_try)}"
    debug_info["response_status"] = last_status_code
    debug_info["error_msg"] = last_error_message
    debug_info["fallback_triggered"] = "Yes"
    
    fallback_msg = get_fallback_message(occasion_name, tone_name, recipient_name, relationship, exclude_texts, extra_note)
    return fallback_msg, False, debug_info

def get_fallback_message(occasion, tone, recipient_name, relationship, exclude_texts=None, extra_note=None):
    """
    Retrieves and fills a randomized rule-based template. Weaves relationship-specific
    phrasing and context sentences to construct exactly 7 sentences.
    - S1: Occasion opening
    - S2, S3: Relationship-specific sentences (reflecting the bond)
    - S4, S5, S6: Context-specific block (if provided, at least 40% context) OR occasion expansion/transition
    - S7: Occasion closing
    """
    rel_lower = relationship.lower().strip()
    
    # 1. Determine relationship group
    rel_clean = rel_lower.replace("my ", "").strip()
    if any(k in rel_clean for k in ['girlfriend', 'boyfriend', 'wife', 'husband', 'partner', 'fiance', 'fiancee', 'fiancé', 'fiancée', 'lover', 'significant other', 'spouse']):
        rel_group = "Romantic"
    elif any(k in rel_clean for k in ['grandpa', 'grandfather']):
        rel_group = "Grandpa"
    elif any(k in rel_clean for k in ['grandma', 'grandmother']):
        rel_group = "Grandma"
    elif any(k in rel_clean for k in ['uncle', 'aunt']):
        rel_group = "Uncle"
    elif any(k in rel_clean for k in ['brother', 'sister', 'sibling']):
        rel_group = "BrotherSister"
    elif any(k in rel_clean for k in ['teacher', 'instructor', 'professor', 'mentor']):
        rel_group = "Teacher"
    elif any(k in rel_clean for k in ['boss', 'manager', 'director', 'supervisor']):
        rel_group = "Boss"
    elif any(k in rel_clean for k in ['mom', 'mother', 'dad', 'father', 'son', 'daughter', 'cousin', 'parent', 'relative']):
        rel_group = "Familial"
    elif any(k in rel_clean for k in ['friend', 'best friend', 'pal', 'mate', 'buddy']):
        rel_group = "Friend"
    else:
        if any(k in rel_clean for k in ['colleague', 'client', 'employee', 'coworker', 'associate', 'staff', 'team']):
            rel_group = "Professional"
        else:
            rel_group = "Friendly"
        
    # Generate relationship phrasing
    if rel_group == "Romantic":
        if 'girlfriend' in rel_clean:
            rel_phrasing = "my beautiful girlfriend"
        elif 'boyfriend' in rel_clean:
            rel_phrasing = "my amazing boyfriend"
        elif 'wife' in rel_clean:
            rel_phrasing = "my wonderful wife"
        elif 'husband' in rel_clean:
            rel_phrasing = "my loving husband"
        elif 'partner' in rel_clean:
            rel_phrasing = "my beloved partner"
        else:
            rel_phrasing = f"my wonderful {rel_clean}"
    elif rel_group in ["Familial", "Grandpa", "Grandma", "Uncle", "BrotherSister"]:
        if any(k in rel_clean for k in ['mom', 'mother']):
            rel_phrasing = "my wonderful mom"
        elif any(k in rel_clean for k in ['dad', 'father']):
            rel_phrasing = "my amazing dad"
        elif any(k in rel_clean for k in ['grandpa', 'grandfather']):
            rel_phrasing = "my dear grandfather"
        elif any(k in rel_clean for k in ['grandma', 'grandmother']):
            rel_phrasing = "my dear grandmother"
        else:
            rel_phrasing = f"my dear {rel_clean}"
    else:
        rel_phrasing = f"my {rel_clean}" if not rel_lower.startswith('my ') else rel_lower

    # 2. Get relationship sentences matching group and tone
    tone_key = tone.strip()
    rel_sentences_key = f"{rel_group}_{tone_key}"
    
    rel_pairs = RELATIONSHIP_SENTENCES.get(rel_sentences_key)
    if not rel_pairs:
        # Fallbacks to broader categories
        if rel_group in ["Grandpa", "Grandma", "Uncle", "BrotherSister"]:
            fallback_key = f"Familial_{tone_key}"
        elif rel_group in ["Teacher", "Boss"]:
            fallback_key = f"Professional_{tone_key}"
        elif rel_group in ["Friend"]:
            fallback_key = f"Friendly_{tone_key}"
        else:
            fallback_key = f"Friendly_{tone_key}"
        rel_pairs = RELATIONSHIP_SENTENCES.get(fallback_key, RELATIONSHIP_SENTENCES.get("Friendly_Warm"))
    
    # 3. Retrieve occasion components
    occ_key = "Birthday"
    for k in OCCASION_TEMPLATES.keys():
        if k.lower() in occasion.lower():
            occ_key = k
            break
            
    occ_data = OCCASION_TEMPLATES.get(occ_key)
    
    excludes = [t.strip() for t in exclude_texts] if exclude_texts else []
    available_candidates = []
    
    # Generate permutations to guarantee uniqueness
    for op in occ_data["openings"]:
        formatted_op = op.format(recipient_name=recipient_name)
        for rel_pair in rel_pairs:
            formatted_rel = [s.format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing) for s in rel_pair]
            for cl in occ_data["closings"]:
                formatted_cl = cl.format(recipient_name=recipient_name)
                
                # Check if context is provided
                context_block = get_semantic_context_sentences(extra_note, occasion)
                if context_block:
                    # S1 (op), S2-S3 (rel), S4-S5-S6 (context), S7 (cl)
                    sentences = [
                        formatted_op,
                        formatted_rel[0],
                        formatted_rel[1],
                        context_block[0].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                        context_block[1].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                        context_block[2].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                        formatted_cl
                    ]
                else:
                    # S1 (op), S2-S3 (rel), S4-S5 (exp), S6 (trans), S7 (cl)
                    for exp_pair in occ_data["expansions"]:
                        formatted_exp = [s.format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing) for s in exp_pair]
                        for trans in occ_data["transitions"]:
                            formatted_trans = trans.format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing)
                            sentences = [
                                formatted_op,
                                formatted_rel[0],
                                formatted_rel[1],
                                formatted_exp[0],
                                formatted_exp[1],
                                formatted_trans,
                                formatted_cl
                            ]
                            full_msg = '\n'.join(sentences)
                            if full_msg.strip() not in excludes:
                                available_candidates.append(full_msg)
                
                if context_block:
                    full_msg = '\n'.join(sentences)
                    if full_msg.strip() not in excludes:
                        available_candidates.append(full_msg)
                        
    if not available_candidates:
        # Fallback to random choice if all permutations are excluded
        op = random.choice(occ_data["openings"]).format(recipient_name=recipient_name)
        rel_pair = random.choice(rel_pairs)
        formatted_rel = [s.format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing) for s in rel_pair]
        cl = random.choice(occ_data["closings"]).format(recipient_name=recipient_name)
        
        context_block = get_semantic_context_sentences(extra_note, occasion)
        if context_block:
            sentences = [
                op,
                formatted_rel[0],
                formatted_rel[1],
                context_block[0].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                context_block[1].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                context_block[2].format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing),
                cl
            ]
        else:
            exp_pair = random.choice(occ_data["expansions"])
            formatted_exp = [s.format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing) for s in exp_pair]
            trans = random.choice(occ_data["transitions"]).format(recipient_name=recipient_name, relationship_phrasing=rel_phrasing)
            sentences = [
                op,
                formatted_rel[0],
                formatted_rel[1],
                formatted_exp[0],
                formatted_exp[1],
                trans,
                cl
            ]
        available_candidates = ['\n'.join(sentences)]
        
    return random.choice(available_candidates)
