# WhatsApp Setup Guide for Technicians

> Zero-cost WhatsApp integration using wa.me links and WhatsApp Business App

---

## 📱 What You Need

1. **WhatsApp Business App** (Free)
   - Download from [App Store](https://apps.apple.com/sg/app/whatsapp-business/id1386412985) or [Play Store](https://play.google.com/store/apps/details?id=com.whatsapp.w4b)
   - Set up your business profile (name, photo, description)

2. **ServiceSync PWA**
   - Your technician profile is live at: `servicesync.sg/your-name`
   - Booking link: `servicesync.sg/your-name/book`

---

## 🚀 Setup (5 Minutes)

### Step 1: Install WhatsApp Business App

```
1. Download WhatsApp Business App
2. Register with your business phone number
3. Set up your business profile:
   - Business name (e.g., "Ah Huat Aircon Services")
   - Category (e.g., "Home Services")
   - Description (e.g., "Professional aircon servicing in Singapore")
   - Business hours
   - Address (optional)
```

### Step 2: Set Up Greeting Message

This auto-replies when customers message you for the first time:

```
1. Open WhatsApp Business App
2. Tap ⋮ (three dots) → Settings → Business Tools → Greeting Message
3. Toggle "Send greeting message" to ON
4. Set to "Outside of business hours" or "Always"
5. Copy this template into the message box:
```

**Template (copy from your PWA profile settings):**
```
Hi! Thanks for contacting [Your Name]! 👋

I'm currently out on a job, but you can check my live availability and book your slot instantly here:
https://servicesync.sg/[your-profile-link]/book

See real-time openings and lock in your preferred time - no waiting for replies! ⚡
```

**Example:**
```
Hi! Thanks for contacting Ah Huat Aircon! 👋

I'm currently out on a job, but you can check my live availability and book your slot instantly here:
https://servicesync.sg/ah-huat-aircon/book

See real-time openings and lock in your preferred time - no waiting for replies! ⚡
```

### Step 3: Set Up Quick Reply (/book)

This lets you send your booking link instantly by typing `/book`:

```
1. Open WhatsApp Business App
2. Tap ⋮ (three dots) → Settings → Business Tools → Quick Replies
3. Tap + (add new)
4. Set up:
   - Shortcut: /book
   - Message: [copy from template below]
```

**Template:**
```
Check my live schedule and book instantly: https://servicesync.sg/[your-profile-link]/book

See all available slots in real-time and secure your booking immediately! 📅
```

**How to use:**
- Customer asks: "Can come tomorrow?"
- You type: `/book`
- WhatsApp auto-expands to the full message with your booking link
- Customer clicks and books instantly

---

## 💬 Daily Workflow

### Receiving Job Requests

**Before (Old Way):**
```
Customer: "Can you come tomorrow 2pm?"
(2 hours later...)
You: "Sorry, 2pm taken. How about 4pm?"
(2 hours later...)
Customer: "4pm I at work. Friday?"
(2 hours later...)
You: "Friday morning ok?"
... (5+ messages back and forth)
```

**After (ServiceSync Way):**
```
Customer: "Can you come tomorrow 2pm?"
You: /book [sends instant link]
Customer: [clicks link, sees availability, books 4pm Friday]
Done! ✅
```

### Sending Invoices (Digital Handshake)

1. **Complete job** in ServiceSync PWA
2. **Tap "Generate Invoice"** - creates PayNow QR code
3. **Tap "Send via WhatsApp"** - opens WhatsApp with pre-filled message
4. **Review message** (already filled with invoice link, amount, notes)
5. **Tap Send** in WhatsApp

**What customer receives:**
```
Hi Mrs Tan! ✅

Your aircon servicing has been completed successfully.

📋 Invoice: https://servicesync.sg/invoice/abc123
💰 Amount: $85.00

Please check the invoice and pay via PayNow QR. 
If there's any issue, just reply to this chat.

Thank you for your business!
- Ah Huat
```

**Customer pays via PayNow QR** → You get money instantly → Everyone's happy!

### Sending Reminders

1. **ServiceSync shows** "Mrs Tan due for 3-month servicing"
2. **Tap "Send Reminder"** - opens WhatsApp with pre-filled message
3. **Tap Send**

**What customer receives:**
```
Hi Mrs Tan! 👋

It's been 3 months since your last aircon servicing (12 Dec 2025).
Time for your next chemical wash to keep it running cool 🌬️

Check my live availability and book instantly here:
https://servicesync.sg/ah-huat-aircon/book

No back-and-forth needed - see what's open and lock in your slot!
```

---

## 🔔 Job Notifications

**How you'll know when someone books:**

1. **Web Push Notification** appears on your phone
   - "🆕 New Job Request! Mrs Tan wants Aircon Servicing - $150"

2. **Tap notification** → Opens ServiceSync PWA

3. **Review details** → Tap "Accept" or "Decline"

4. **If accepted:** Job appears in your schedule with optimized route

**No SMS charges, no WhatsApp API fees, completely free!**

---

## 🛡️ Trust Building (Digital Handshake)

**Problem:** Customer worries about paying cash to a stranger

**Solution:** Service link creates trust

1. **After job completion:** PWA generates secure invoice link
2. **Technician sends:** "Here is the invoice link: [URL]"
3. **Customer sees:**
   - Your verified profile
   - Service details
   - PayNow QR code
   - Professional invoice
   - "Reply to chat if any issues"

4. **Customer pays** via PayNow QR (bank-to-bank, instant)

5. **Both parties protected:**
   - Customer has invoice receipt
   - You have payment confirmation
   - Everything tracked in ServiceSync

---

## 📊 Cost Comparison

| Feature | WhatsApp API | ServiceSync (wa.me) |
|---------|--------------|---------------------|
| Send greeting message | $0.0085 | **Free** |
| Job notification | $0.0085 | **Free** (Web Push) |
| Invoice delivery | $0.0085 | **Free** |
| Reminder message | $0.0085 | **Free** |
| Monthly cost (100 jobs) | ~$50-100 | **$0** |
| Setup time | 2-4 weeks approval | **5 minutes** |

**You save: $600-1,200/year**

---

## 🎯 Pro Tips

### Tip 1: Use Greeting Message to Train Customers

The greeting message trains customers to use your booking link automatically. After a few times, they'll just click the link instead of messaging back and forth.

### Tip 2: Quick Replies for Common Questions

Set up more quick replies:
- `/price` → Your service menu with prices
- `/location` → "I service these areas: Tampines, Bedok, Simei..."
- `/emergency` → Emergency contact info

### Tip 3: Keep Conversations in One Thread

Since wa.me links open the same WhatsApp chat:
- Booking confirmation → Same thread
- Invoice → Same thread  
- Follow-up questions → Same thread
- Customer has complete history

### Tip 4: Follow Up Quickly

When you get a push notification for a new job:
- Accept within 5 minutes = Higher customer satisfaction
- Customer sees your responsiveness = More referrals

### Tip 5: Use the Booking Link in Your Carousell/Facebook

Post your booking link everywhere:
- Carousell listings
- Facebook Marketplace
- Telegram groups
- Business cards

Example: "Book instantly (no PM needed): servicesync.sg/ah-huat-aircon/book"

---

## ❓ FAQ

**Q: Do customers need to install anything?**  
A: No! They just click the link in WhatsApp and book in their browser.

**Q: What if customer doesn't have WhatsApp?**  
A: They can still book via your web link. You just won't use the wa.me feature for them.

**Q: Can I still type normal messages?**  
A: Yes! This doesn't replace WhatsApp - it just adds convenient shortcuts.

**Q: Is this officially supported by WhatsApp?**  
A: Yes! wa.me is an official WhatsApp feature for Click to Chat.

**Q: What if I change my phone number?**  
A: Update your ServiceSync profile. The booking link stays the same (servicesync.sg/your-name).

**Q: Do I need to keep the PWA open?**  
A: No! Push notifications work even when PWA is closed.

---

## 🔧 Troubleshooting

### Greeting message not sending?
- Check it's toggled ON in WhatsApp Business settings
- Verify "Recipients" is set correctly ("Everyone" or "Not in address book")
- Restart WhatsApp Business app

### Quick reply not working?
- Make sure you type exactly `/book` (including the /)
- Check no extra spaces
- Try re-saving the quick reply

### Push notifications not appearing?
- Allow notifications when PWA prompts you
- Check phone settings → Notifications → Chrome/Safari → Allow
- On iOS: Add PWA to home screen for best notification support

### wa.me link not opening WhatsApp?
- Customer needs WhatsApp installed
- On desktop, it opens WhatsApp Web
- Some browsers may ask permission to open external app

---

## 📞 Need Help?

- **ServiceSync Support:** help@servicesync.sg
- **WhatsApp Business Help:** In-app → Settings → Help

---

*Zero API costs. Zero complexity. Maximum automation.*  
*ServiceSync - Built for Singapore's home service professionals*
