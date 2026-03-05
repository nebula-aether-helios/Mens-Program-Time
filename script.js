/* ============================================
   PROGRAM TIME — Reservation Engine (Appwrite)
   ============================================

   SETUP (one-time in Appwrite Console — cloud.appwrite.io):
   1. Create a project (e.g. "Program Time")
   2. Under Databases → create a database (e.g. "main")
   3. Inside that database → create a collection called "reservations"
   4. Add these attributes to the collection:
        - date      (String, size 10, required)        → "YYYY-MM-DD"
        - section   (String, size 10, required)        → "morning" or "afternoon"
        - name      (String, size 60, required)
        - contact   (String, size 60, required)
   5. Under the collection's Settings → Permissions:
        - Add role "Any" → check "Create" and "Read"
   6. Replace the three IDs below with your own values from the Console.

   That's it — no server functions, no API keys exposed.
   ============================================ */

// ─── CONFIG ──────────────────────────────────────────────────────────
const APPWRITE_ENDPOINT = 'https://sfo.cloud.appwrite.io/v1';
const APPWRITE_PROJECT  = '695f501e002f2e93fcb1';
const DATABASE_ID       = 'program-time-db';
const COLLECTION_ID     = 'reservations';
const MAX_PER_SECTION   = 2;
// ─────────────────────────────────────────────────────────────────────

// ─── SDK INIT ────────────────────────────────────────────────────────
const { Client, Databases, Query, ID } = Appwrite;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

const databases = new Databases(client);

// ─── DOM REFS ────────────────────────────────────────────────────────
const dateInput      = document.getElementById('session-date');
const spotsMorning   = document.getElementById('spots-morning');
const spotsAfternoon = document.getElementById('spots-afternoon');
const formMorning    = document.getElementById('form-morning');
const formAfternoon  = document.getElementById('form-afternoon');
const fullMorning    = document.getElementById('full-morning');
const fullAfternoon  = document.getElementById('full-afternoon');
const confirmMorning = document.getElementById('confirm-morning');
const confirmAfternoon = document.getElementById('confirm-afternoon');
const cardMorning    = document.getElementById('card-morning');
const cardAfternoon  = document.getElementById('card-afternoon');

// ─── DATE SETUP ──────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
dateInput.value = todayStr();
dateInput.min = todayStr();
dateInput.addEventListener('change', () => refreshSpots());

// ─── FETCH SPOT COUNTS ──────────────────────────────────────────────
async function getCount(date, section) {
  try {
    const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal('date', date),
      Query.equal('section', section),
      Query.limit(MAX_PER_SECTION)
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

async function refreshSpots() {
  const date = dateInput.value;

  // Reset UI for both cards
  [confirmMorning, confirmAfternoon].forEach(el => el.classList.add('hidden'));
  cardMorning.querySelector('.card-front').style.display = '';
  cardAfternoon.querySelector('.card-front').style.display = '';

  const [mCount, aCount] = await Promise.all([
    getCount(date, 'morning'),
    getCount(date, 'afternoon')
  ]);

  updateCard('morning', mCount);
  updateCard('afternoon', aCount);
}

function updateCard(section, count) {
  const remaining = MAX_PER_SECTION - count;
  const isFull = remaining <= 0;

  const spotsEl = section === 'morning' ? spotsMorning : spotsAfternoon;
  const formEl  = section === 'morning' ? formMorning  : formAfternoon;
  const fullEl  = section === 'morning' ? fullMorning  : fullAfternoon;

  spotsEl.textContent = Math.max(remaining, 0);

  if (isFull) {
    formEl.classList.add('hidden');
    fullEl.classList.remove('hidden');
  } else {
    formEl.classList.remove('hidden');
    fullEl.classList.add('hidden');
  }
}

// ─── RESERVATION SUBMIT ─────────────────────────────────────────────
document.querySelectorAll('.btn-lock').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const section = btn.dataset.section;
    const card = section === 'morning' ? cardMorning : cardAfternoon;
    const formEl = card.querySelector('.card-form');
    const nameInput = formEl.querySelector('.input-name');
    const contactInput = formEl.querySelector('.input-contact');

    const name = nameInput.value.trim();
    const contact = contactInput.value.trim();

    // Validate
    if (!name || !contact) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 400);
      return;
    }

    const date = dateInput.value;
    btn.disabled = true;
    btn.textContent = 'LOCKING IN...';

    try {
      // Re-check count to prevent race condition overflow
      const currentCount = await getCount(date, section);
      if (currentCount >= MAX_PER_SECTION) {
        updateCard(section, currentCount);
        btn.disabled = false;
        btn.textContent = 'LOCK IN';
        return;
      }

      // Create the reservation document
      await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
        date,
        section,
        name,
        contact
      });

      // Show confirmation
      const confirmEl = section === 'morning' ? confirmMorning : confirmAfternoon;
      card.querySelector('.card-front').style.display = 'none';
      confirmEl.classList.remove('hidden');

      // Refresh the other card's count too
      refreshSpots();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'LOCK IN';
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 400);
    }
  });
});

// ─── SCROLL FADE-IN ──────────────────────────────────────────────────
function initFadeIn() {
  document.querySelectorAll('#about, #reserve, .session-card, .rule-card').forEach(el => {
    el.classList.add('fade-in');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ─── INIT ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFadeIn();
  refreshSpots();
});
