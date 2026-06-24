# backend/app/utils/prompt_builder.py
# This file compiles parameters into a single prompt string for the Gemini API.
# It guides the AI to output exactly what is needed for personalized cards.

def build_generation_prompt(recipient_name, relationship, occasion_name, tone_name, extra_note=None, exclude_texts=None, random_seed=None):
    """
    Assembles input parameters into a structured prompt instruction for the AI.
    """
    rel_lower = relationship.lower().strip()
    
    # Determine if relationship is intimate/romantic
    is_intimate = rel_lower in ['girlfriend', 'boyfriend', 'wife', 'husband', 'partner', 'fiance', 'fiancee', 'fiancé', 'fiancée', 'lover', 'significant other']
    
    prompt = (
        f"Write a personalized greeting message for a card.\n"
        f"- Recipient Name: {recipient_name}\n"
        f"- Relationship to Sender: {relationship}\n"
        f"- Occasion: {occasion_name}\n"
        f"- Emotional Tone Style: {tone_name}\n"
    )
    
    # Determine relationship-specific theme guidance
    rel_theme = ""
    rel_clean = rel_lower.replace("my ", "").strip()
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
        "1. Write a unique, custom, and creative greeting card message. Avoid generic, cliché greeting-card language. The message must sound like a real person wrote it by hand.\n"
        f"2. Write ONLY the final greeting message itself. Do not include subject lines, placeholders, sign-offs, or standard greetings (like 'Dear Name') unless it flows naturally as part of the card body. You MUST explicitly include the recipient's name ('{recipient_name}') somewhere within the generated message text, weaving it naturally into one of the sentences.\n"
    )
    
    # Tone Guidelines
    tone_lower = tone_name.lower().strip()
    if tone_lower == 'warm':
        prompt += "3. Tone Style - Warm: The wording must feel deeply affectionate, caring, and friendly, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'formal':
        prompt += "3. Tone Style - Formal: The wording must feel respectful, professional, and elegant, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'funny':
        prompt += "3. Tone Style - Funny: The wording must feel light-hearted, playful, and humorous/witty, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'heartfelt':
        prompt += "3. Tone Style - Heartfelt: The wording must feel deep, emotional, and highly sincere, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'professional':
        prompt += "3. Tone Style - Professional: The wording must feel polished, corporate-appropriate, and business-focused, and this tone must be preserved consistently throughout the entire message.\n"
    elif tone_lower == 'inspirational':
        prompt += "3. Tone Style - Inspirational: The wording must feel motivational, uplifting, and encouraging, and this tone must be preserved consistently throughout the entire message.\n"
    else:
        prompt += f"3. Match the requested emotional tone style strictly: {tone_name}.\n"
        
    prompt += (
        "4. Structural requirement: The message MUST consist of exactly 6 to 10 short, distinct, card-style lines (each line separated by a single line break '\\n'). Each line must be a single, concise sentence of 8 to 18 words. Avoid writing long, run-on, or winding sentences. The total length MUST be strictly between 6 and 10 lines.\n"
        "5. Occasion Backdrop constraint: The occasion ('" + occasion_name + "') must act strictly as the background backdrop (e.g. it is their birthday or anniversary), but it must NOT dominate the message. The core of the message must be driven by the specific context and relationship connection.\n"
    )
    
    if is_intimate:
        prompt += (
            "6. Since the relationship is intimate/romantic, the message must feel deeply personal, genuine, warm, and affectionate. "
            "Use natural, loving expressions and avoid stiff, clinical, or formal phrasing. It should feel organic, romantic, and sincere.\n"
        )
    else:
        prompt += (
            "6. Keep the message natural, warm, and appropriate for the relationship. Avoid robotic phrasing.\n"
        )
        
    prompt += (
        "7. Do not output quotes surrounding the message.\n"
        f"8. PERSPECTIVE RULE: Write the message strictly in the **1st person / direct address** speaking directly **to** the recipient (using 'you', 'your', 'we') rather than speaking *about* the recipient in the 3rd person. For example, instead of writing '{recipient_name} is amazing' or 'her kindness', write 'you are amazing, {recipient_name}' or 'your kindness'. The sender is writing this message directly to the recipient."
    )
    
    return prompt
