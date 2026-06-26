# backend/app/utils/prompt_builder.py
# This file compiles parameters into a single prompt string for the Gemini API.
# It guides the AI to output exactly what is needed for personalized cards.

def build_generation_prompt(recipient_name, relationship, occasion_name, tone_name, extra_note=None, exclude_texts=None, random_seed=None):
    """
    Assembles input parameters into a structured prompt instruction for the AI,
    clearly defining roles and perspectives to prevent relationship inversion.
    """
    rel_lower = relationship.lower().strip()
    
    # Determine if relationship is intimate/romantic
    is_intimate = rel_lower in ['girlfriend', 'boyfriend', 'wife', 'husband', 'partner', 'fiance', 'fiancee', 'lover', 'significant other']
    
    # Clean up the relationship term for role mapping
    rel_clean = rel_lower.replace("my ", "").strip()
    
    # Predefined role mappings (Sender role, Recipient role, Perspective explanation)
    # The Relationship always describes the recipient's relationship to the sender.
    role_map = {
        "father": ("child (son or daughter)", "father", "child writing to their father"),
        "dad": ("child (son or daughter)", "father", "child writing to their dad"),
        "daddy": ("child (son or daughter)", "father", "child writing to their daddy"),
        "papa": ("child (son or daughter)", "father/grandfather", "writing to their papa"),
        "mother": ("child (son or daughter)", "mother", "child writing to their mother"),
        "mom": ("child (son or daughter)", "mother", "child writing to their mom"),
        "mommy": ("child (son or daughter)", "mother", "child writing to their mommy"),
        "mama": ("child (son or daughter)", "mother", "child writing to their mama"),
        "son": ("parent (mother or father)", "son", "parent writing to their son"),
        "daughter": ("parent (mother or father)", "daughter", "parent writing to their daughter"),
        "brother": ("sibling (brother or sister)", "brother", "sibling writing to their brother"),
        "sister": ("sibling (brother or sister)", "sister", "sibling writing to their sister"),
        "husband": ("wife/spouse", "husband", "wife/spouse writing to their husband"),
        "wife": ("husband/spouse", "wife", "husband/spouse writing to their wife"),
        "boyfriend": ("partner", "boyfriend", "partner writing to their boyfriend"),
        "girlfriend": ("partner", "girlfriend", "partner writing to their girlfriend"),
        "friend": ("friend", "friend", "friend writing to their friend"),
        "teacher": ("student", "teacher", "student writing to their teacher"),
        "mentor": ("mentee/student", "mentor", "mentee writing to their mentor"),
        "boss": ("employee", "boss/manager", "employee writing to their boss/manager"),
        "manager": ("employee", "boss/manager", "employee writing to their manager"),
        "colleague": ("colleague/coworker", "colleague/coworker", "colleague writing to their colleague"),
        "grandmother": ("grandchild", "grandmother", "grandchild writing to their grandmother"),
        "grandma": ("grandchild", "grandmother", "grandchild writing to their grandma"),
        "grandfather": ("grandchild", "grandfather", "grandchild writing to their grandfather"),
        "grandpa": ("grandchild", "grandfather", "grandchild writing to their grandpa"),
        "uncle": ("nephew/niece", "uncle", "nephew/niece writing to their uncle"),
        "aunt": ("nephew/niece", "aunt", "nephew/niece writing to their aunt"),
    }

    if rel_clean in role_map:
        sender_role, recipient_role, perspective = role_map[rel_clean]
    else:
        # Dynamic fallback parser for custom or unrecognized relationships
        # SENDER is always the user generating the message; RECIPIENT is the person with the entered relationship.
        sender_role = "sender"
        recipient_role = relationship
        perspective = f"sender writing directly to their {relationship}"
        
        # Substring heuristics to detect custom family/professional hierarchies
        if "father" in rel_clean or "dad" in rel_clean or "pop" in rel_clean:
            sender_role = "child"
            recipient_role = f"father-figure ({relationship})"
            perspective = f"child writing to their father-figure ({relationship})"
        elif "mother" in rel_clean or "mom" in rel_clean or "mama" in rel_clean:
            sender_role = "child"
            recipient_role = f"mother-figure ({relationship})"
            perspective = f"child writing to their mother-figure ({relationship})"
        elif "son" in rel_clean:
            sender_role = "parent"
            recipient_role = f"son ({relationship})"
            perspective = f"parent writing to their son ({relationship})"
        elif "daughter" in rel_clean:
            sender_role = "parent"
            recipient_role = f"daughter ({relationship})"
            perspective = f"parent writing to their daughter ({relationship})"
        elif "husband" in rel_clean or "wife" in rel_clean or "spouse" in rel_clean or "partner" in rel_clean or "fiance" in rel_clean:
            sender_role = "spouse/partner"
            recipient_role = f"spouse/partner ({relationship})"
            perspective = f"spouse/partner writing to their spouse/partner ({relationship})"
        elif "boss" in rel_clean or "manager" in rel_clean or "supervisor" in rel_clean or "employer" in rel_clean:
            sender_role = "employee"
            recipient_role = f"boss/manager ({relationship})"
            perspective = f"employee writing to their boss/manager ({relationship})"
        elif "teacher" in rel_clean or "mentor" in rel_clean or "professor" in rel_clean or "instructor" in rel_clean:
            sender_role = "student/mentee"
            recipient_role = f"teacher/mentor ({relationship})"
            perspective = f"student/mentee writing to their teacher/mentor ({relationship})"

    PERSPECTIVE_DIRECTIONS = {
        "father": "recipient is the sender's father (so the sender is writing to their father)",
        "dad": "recipient is the sender's father (so the sender is writing to their father)",
        "daddy": "recipient is the sender's father (so the sender is writing to their father)",
        "mother": "recipient is the sender's mother (so the sender is writing to their mother)",
        "mom": "recipient is the sender's mother (so the sender is writing to their mother)",
        "mommy": "recipient is the sender's mother (so the sender is writing to their mother)",
        "son": "recipient is the sender's son (so the sender is writing to their son)",
        "daughter": "recipient is the sender's daughter (so the sender is writing to their daughter)",
        "husband": "recipient is the sender's husband (so the sender is writing to their husband)",
        "wife": "recipient is the sender's wife (so the sender is writing to their wife)",
        "brother": "recipient is the sender's brother (so the sender is writing to their brother)",
        "sister": "recipient is the sender's sister (so the sender is writing to their sister)",
        "friend": "recipient is the sender's friend (so the sender is writing to their friend)",
        "teacher": "recipient is the sender's teacher (so the sender is writing to their teacher)",
        "boss": "recipient is the sender's boss (so the sender is writing to their boss)",
        "manager": "recipient is the sender's boss/manager (so the sender is writing to their boss/manager)",
        "mentor": "recipient is the sender's mentor (so the sender is writing to their mentor)",
        "colleague": "recipient is the sender's colleague (so the sender is writing to their colleague)",
    }
    direction = PERSPECTIVE_DIRECTIONS.get(rel_clean, f"recipient is the sender's {relationship} (so the sender is writing to their {relationship})")

    PERSPECTIVE_TITLES = {
        "father": ["Dad", "Father", "my dear Dad", "my beloved Father"],
        "dad": ["Dad", "Father", "my dear Dad", "my beloved Father"],
        "daddy": ["Dad", "Father", "my dear Dad", "my beloved Father"],
        "mother": ["Mom", "Mother", "my dear Mother", "my beloved Mother"],
        "mom": ["Mom", "Mother", "my dear Mother", "my beloved Mother"],
        "mommy": ["Mom", "Mother", "my dear Mother", "my beloved Mother"],
        "mama": ["Mom", "Mother", "my dear Mother", "my beloved Mother"],
        "brother": ["brother", "bro"],
        "sister": ["sister", "sis"],
        "friend": ["friend", "buddy", "dear friend"],
        "teacher": ["Sir", "Ma'am", "Teacher", "Professor"],
        "boss": ["Sir", "Ma'am", "Boss", "Manager"],
        "manager": ["Sir", "Ma'am", "Boss", "Manager"],
        "wife": ["my love", "dear wife", "my beloved"],
        "husband": ["my dear husband", "my love", "my beloved"],
        "boyfriend": ["my love", "dear boyfriend", "my sweetheart"],
        "girlfriend": ["my love", "dear girlfriend", "my sweetheart"],
        "mentor": ["Sir", "Ma'am", "mentor", "guide"],
        "colleague": ["colleague", "friend"],
    }
    titles_list = PERSPECTIVE_TITLES.get(rel_clean, [relationship])
    titles_str = ", ".join([f"'{t}'" for t in titles_list])

    prompt = (
        f"Write a personalized greeting message for a card.\n"
        f"CRITICAL RULES (TAKE PRECEDENCE OVER ALL OTHER INSTRUCTIONS):\n"
        f"1. The relationship always describes the recipient's relationship to the sender. Never interpret it as describing the sender.\n"
        f"2. Sender: {sender_role} (The currently logged-in user generating the message)\n"
        f"3. Recipient: {recipient_name} (The person receiving the card)\n"
        f"4. Relationship: {relationship} (which means the {direction})\n"
        f"5. Writing Direction: The message must always be written FROM the {sender_role} TO the recipient {recipient_name} (the {recipient_role}). Do NOT write as if the sender is the {relationship}.\n"
        f"6. Addressing the Recipient: If a meaningful relationship title exists, primarily use that title throughout the message. Use the recipient's first name ('{recipient_name}') sparingly and never repeatedly. Specifically, prefer using natural, human relationship titles such as: {titles_str}. Do NOT repeatedly use the recipient's first name ('{recipient_name}') throughout the message, as that sounds robotic. You may include the recipient's first name ('{recipient_name}') at most once in the message if it fits naturally, but rely primarily on the relationship titles above.\n"
        f"7. AI Writing Quality & Cliché Elimination: Write in a warm, natural, and human voice that sounds like a real person wrote it by hand. You MUST vary your sentence lengths, sentence openings, paragraph structures, and message flows. Avoid clichéd emotional expressions or repetitive phrases. Do NOT use safe, repetitive greeting-card clichés such as 'You bring so much joy to my life', 'I cherish our bond', 'You mean the world to me', 'Your kindness inspires me', 'I am grateful for everything you do', or 'You have always been there for me'. Ensure every line is fresh, original, and meaningful so that no two generated messages feel like template variations.\n\n"
        f"- SENDER: {sender_role}\n"
        f"- RECIPIENT: {recipient_name}\n"
        f"- RECIPIENT RELATIONSHIP: {relationship} (meaning the {direction})\n"
        f"- WRITING PERSPECTIVE: {perspective} (First-person direct address using 'you', 'your', 'we' from the sender to the recipient)\n"
        f"- INTENDED AUDIENCE: {recipient_name} (the {recipient_role})\n"
        f"- Occasion: {occasion_name}\n"
        f"- Emotional Tone Style: {tone_name}\n"
    )
    
    # Determine relationship-specific theme guidance
    rel_theme = ""
    if any(k in rel_clean for k in ['grandpa', 'grandfather']):
        rel_theme = "Grandpa theme: emphasize family warmth, wisdom, respect, and shared family memories."
    elif any(k in rel_clean for k in ['grandma', 'grandmother']):
        rel_theme = "Grandma theme: emphasize affection, gratitude, and family love."
    elif any(k in rel_clean for k in ['uncle', 'aunt']):
        rel_theme = "Uncle/Aunt theme: emphasize family connection, admiration, and warmth."
    elif any(k in rel_clean for k in ['friend', 'pal', 'mate', 'buddy']):
        rel_theme = "Friend theme: emphasize a casual, playful, and personal friendship connection."
    elif any(k in rel_clean for k in ['brother', 'sister', 'sibling']):
        rel_theme = "Brother/Sister theme: emphasize a friendly, fun, and emotional sibling bond."
    elif any(k in rel_clean for k in ['teacher', 'instructor', 'professor', 'mentor']):
        rel_theme = "Teacher theme: emphasize gratitude, respect, and educational appreciation."
    elif any(k in rel_clean for k in ['boss', 'manager', 'director', 'supervisor']):
        rel_theme = "Boss theme: emphasize professional respect, leadership guidance, and appreciation."
    elif is_intimate:
        rel_theme = "Romantic partner theme: emphasize deep personal affection, sincere romantic bond, and warmth."
    else:
        rel_theme = "Emphasize appropriate personal/professional connection, warmth, and shared appreciation."

    prompt += (
        f"- PERSONALIZATION PRIORITY ORDER (Strictly enforce this weighting):\n"
        f"  1. Context Meaning (40% priority): The meaning of the context drives the core message content.\n"
        f"  2. Relationship (25% priority): The relationship drives the emotional style and themes.\n"
        f"  3. Occasion (20% priority): The occasion provides the structural background/backdrop.\n"
        f"  4. Tone (15% priority): The tone style influences the choice of wording and vocabulary.\n\n"
    )

    if extra_note and extra_note.strip():
        prompt += (
            f"- Context / Special Note details: '{extra_note.strip()}'\n"
            f"- CRITICAL HIGHEST PRIORITY (Context Priority): This context is the absolute primary personalization source of the message. "
            f"At least 40% of the sentences in the message MUST relate directly to and expand upon this context.\n"
            f"- CONTEXT SAFETY RULE: Understand the semantic meaning of the context (e.g. if 'retired last week', interpret it as retirement/new chapter; if 'he has cricket addiction', interpret it as cricket passion). "
            f"Do NOT copy the raw context text or insert consecutive words from the context note. Never use the raw context word-for-word. "
            f"If 4 or more consecutive words from the user's context note are copied unchanged in the output, it will violate safety rules. Always use context interpretation rather than context copying, and weave the interpreted meaning naturally into complete, meaningful sentences.\n"
        )
        
    prompt += (
        f"- SECONDARY PRIORITY (Relationship Priority): At least 2 complete sentences in the message MUST directly reflect your relationship ('{relationship}') and unique connection to the recipient. "
        f"Follow this specific theme guideline: {rel_theme}\n"
    )
    
    if exclude_texts:
        valid_excludes = [t.strip() for t in exclude_texts if t and t.strip()]
        if valid_excludes:
            formatted_list = "\n".join([f"  * '{text}'" for text in valid_excludes])
            prompt += (
                f"- Critical uniqueness constraint: The user wants a completely unique and different message than their previous attempts. "
                f"Do NOT generate anything similar to or using the same phrasing as any of these previous attempts:\n{formatted_list}\n"
            )
            
    if random_seed:
        prompt += (
            f"- Seed code: {random_seed}\n"
            f"- Structural variety instruction: Use a completely different opening statement, transition, and closing statement than any standard message. "
            f"Vary your sentence structure, phrasing, and vocabulary to be unique. Do NOT use generic templates.\n"
        )
        
    prompt += (
        "\nInstructions:\n"
        "1. ROLE SAFETY AND PERSPECTIVE VALIDATION: Before writing the message, you MUST internally validate the roles:\n"
        f"   * Who is the sender? (Answer: The sender is the {sender_role})\n"
        f"   * Who is the recipient? (Answer: The recipient is {recipient_name})\n"
        f"   * Who does the relationship describe? (Answer: The relationship '{relationship}' describes the recipient, {recipient_name})\n"
        f"   * Is the message being written TO that recipient? (Answer: Yes, the message must be written FROM the {sender_role} TO the recipient {recipient_name})\n"
        f"   Double-check that you DO NOT write as if the sender is the {relationship}. For example, if writing to your Father, do NOT write 'I am proud to be your father' or 'From your dad'; you are the child writing to your father, so write 'You have been an amazing father to me'. Never reverse these roles under any circumstances.\n"
        "2. Write a unique, custom, and creative greeting card message. Avoid generic, cliché greeting-card language. The message must sound like a real person wrote it by hand.\n"
        f"3. Write ONLY the final greeting message itself. Do not include subject lines, placeholders, sign-offs, or standard greetings (like 'Dear Name') unless it flows naturally as part of the card body. You may optionally include the recipient's first name ('{recipient_name}') at most once somewhere within the generated message text, weaving it naturally into one of the sentences, but rely primarily on the relationship titles for addressing the recipient.\n"
    )
    
    # Tone Guidelines
    # Note: Preserving exact original tone wording block for backward compatibility
    tone_lower = tone_name.lower().strip()
    if tone_lower == 'warm':
        prompt += "4. Tone Style - Warm: The wording must feel deeply affectionate, caring, and friendly, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'formal':
        prompt += "4. Tone Style - Formal: The wording must feel respectful, professional, and elegant, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'funny':
        prompt += "4. Tone Style - Funny: The wording must feel light-hearted, playful, and humorous/witty, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'heartfelt':
        prompt += "4. Tone Style - Heartfelt: The wording must feel deep, emotional, and highly sincere, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'professional':
        prompt += "4. Tone Style - Professional: The wording must feel polished, corporate-appropriate, and business-focused, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'inspirational':
        prompt += "4. Tone Style - Inspirational: The wording must feel motivational, uplifting, and encouraging, and this tone must be preserved consistently throughout the entire message.\n"
    else:
        prompt += f"4. Match the requested emotional tone style strictly: {tone_name}.\n"
        
    prompt += (
        "5. Structural requirement: The message MUST consist of exactly 6 to 10 short, distinct, card-style lines (each line separated by a single line break '\\n'). Each line must be a single, concise sentence of 8 to 18 words. Avoid writing long, run-on, or winding sentences. The total length MUST be strictly between 6 and 10 lines.\n"
        "6. Occasion Backdrop constraint: The occasion ('" + occasion_name + "') must act strictly as the background backdrop (e.g. it is their birthday or anniversary), but it must NOT dominate the message. The core of the message must be driven by the specific context and relationship connection.\n"
    )
    
    if is_intimate:
        prompt += (
            "7. Since the relationship is intimate/romantic, the message must feel deeply personal, genuine, warm, and affectionate. "
            "Use natural, loving expressions and avoid stiff, clinical, or formal phrasing. It should feel organic, romantic, and sincere.\n"
        )
    else:
        prompt += (
            "7. Keep the message natural, warm, and appropriate for the relationship. Avoid robotic phrasing.\n"
        )
        
    prompt += (
        "8. Do not output quotes surrounding the message.\n"
        f"9. PERSPECTIVE RULE: Write the message strictly in the **1st person / direct address** speaking directly **to** the recipient (using 'you', 'your', 'we') rather than speaking *about* the recipient in the 3rd person. For example, instead of writing '{recipient_name} is amazing' or 'her kindness', write 'you are amazing, {recipient_name}' or 'your kindness'. The sender is writing this message directly to the recipient."
    )
    
    return prompt
