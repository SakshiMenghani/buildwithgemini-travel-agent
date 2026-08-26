// Roam AI Agent - Frontend JavaScript App

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let currentItinerary = null;
  let activeDayIndex = 0;
  let userPreferences = null;

  // DOM Element References
  const brandHome = document.getElementById('brand-home');
  const welcomeSection = document.getElementById('welcome-section');
  const tripDashboard = document.getElementById('trip-dashboard');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingTitle = document.getElementById('loading-title');

  // Modals
  const modalTripBuilder = document.getElementById('modal-trip-builder');
  const modalPreferences = document.getElementById('modal-preferences');

  // Buttons & Inputs
  const btnNewTrip = document.getElementById('btn-new-trip');
  const btnPreferences = document.getElementById('btn-preferences');
  const btnQuickPlan = document.getElementById('btn-quick-plan');
  const quickPromptInput = document.getElementById('quick-prompt');
  const tripBuilderForm = document.getElementById('trip-builder-form');
  const preferencesForm = document.getElementById('preferences-form');
  const replanInput = document.getElementById('replan-input');
  const btnSubmitReplan = document.getElementById('btn-submit-replan');

  // Modal Closers
  document.getElementById('close-builder-modal').addEventListener('click', () => hideModal(modalTripBuilder));
  document.getElementById('cancel-builder-modal').addEventListener('click', () => hideModal(modalTripBuilder));
  document.getElementById('close-pref-modal').addEventListener('click', () => hideModal(modalPreferences));
  document.getElementById('cancel-pref-modal').addEventListener('click', () => hideModal(modalPreferences));

  // Initialize
  loadUserPreferences();

  // Navigation: Return to Main Menu on Brand Click
  brandHome.addEventListener('click', () => {
    returnToMainMenu();
  });

  function returnToMainMenu() {
    tripDashboard.classList.add('hidden');
    welcomeSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Event Listeners
  btnNewTrip.addEventListener('click', () => {
    showModal(modalTripBuilder);
  });

  btnPreferences.addEventListener('click', () => {
    showModal(modalPreferences);
  });

  // Sample prompt chips on welcome screen
  document.querySelectorAll('.popular-destinations .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      quickPromptInput.value = prompt;
      generateItineraryFromPrompt(prompt);
    });
  });

  // Quick Plan Button Submit (Supports both plain destination or full prompt)
  btnQuickPlan.addEventListener('click', () => {
    const text = quickPromptInput.value.trim();
    if (!text) {
      alert('Please enter a destination or describe your trip prompt.');
      return;
    }
    
    // Check if it's a detailed prompt vs single city name
    if (text.length > 25 || text.includes('day') || text.includes('under') || text.includes('trip') || text.includes('with')) {
      generateItineraryFromPrompt(text);
    } else {
      openBuilderWithDestination(text);
    }
  });

  quickPromptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      btnQuickPlan.click();
    }
  });

  function openBuilderWithDestination(dest) {
    document.getElementById('modal-destination').value = dest;
    showModal(modalTripBuilder);
  }

  // Trip Builder Form Submit
  tripBuilderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModal(modalTripBuilder);

    const destination = document.getElementById('modal-destination').value.trim();
    const startDate = document.getElementById('modal-start-date').value;
    const endDate = document.getElementById('modal-end-date').value;
    const budget = document.getElementById('modal-budget').value;
    const pace = document.getElementById('modal-pace').value;
    const customNotes = document.getElementById('modal-notes').value;

    const interests = [];
    document.querySelectorAll('#interest-checkboxes input[type="checkbox"]:checked').forEach(cb => {
      interests.push(cb.value);
    });

    const requestData = {
      destination,
      start_date: startDate,
      end_date: endDate,
      budget,
      pace,
      interests: interests.length > 0 ? interests : ["Culture", "Foodie"],
      custom_notes: customNotes,
      preferences: userPreferences
    };

    await generateItinerary(requestData);
  });

  // Preferences Form Submit
  preferencesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModal(modalPreferences);

    const dietaryStr = document.getElementById('pref-dietary').value;
    const dietaryList = dietaryStr ? dietaryStr.split(',').map(s => s.trim()) : [];

    userPreferences = {
      dietary_restrictions: dietaryList,
      travel_pace: document.getElementById('pref-pace').value,
      preferred_transport: document.getElementById('pref-transport').value,
      saved_notes: document.getElementById('pref-notes').value,
      budget_level: "Moderate",
      interests: ["Culture", "Foodie"],
      accessibility_needs: []
    };

    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPreferences)
      });
      if (res.ok) {
        userPreferences = await res.json();
        alert('Travel preferences saved successfully!');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
  });

  // Re-plan Submit
  btnSubmitReplan.addEventListener('click', async () => {
    const prompt = replanInput.value.trim();
    if (!prompt) {
      alert('Please enter a modification or instruction for re-planning.');
      return;
    }
    await triggerReplan(prompt);
  });

  replanInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnSubmitReplan.click();
    }
  });

  document.querySelectorAll('.replan-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      replanInput.value = prompt;
      triggerReplan(prompt);
    });
  });

  // API Call: Load User Preferences
  async function loadUserPreferences() {
    try {
      const res = await fetch('/api/preferences');
      if (res.ok) {
        userPreferences = await res.json();
        if (userPreferences) {
          document.getElementById('pref-dietary').value = (userPreferences.dietary_restrictions || []).join(', ');
          document.getElementById('pref-pace').value = userPreferences.travel_pace || 'Balanced';
          document.getElementById('pref-transport').value = userPreferences.preferred_transport || 'Public Transit / Walking';
          document.getElementById('pref-notes').value = userPreferences.saved_notes || '';
        }
      }
    } catch (err) {
      console.warn('Preferences load error:', err);
    }
  }

  // API Call: Generate Itinerary from Natural Language Prompt
  async function generateItineraryFromPrompt(promptText) {
    showLoading('Roam AI is analyzing your prompt...', `Extracting destination, dates, budget & interests with Gemini`);
    try {
      const res = await fetch('/api/itinerary/from-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, preferences: userPreferences })
      });

      if (!res.ok) {
        throw new Error('Failed to generate itinerary from prompt.');
      }

      currentItinerary = await res.json();
      activeDayIndex = 0;
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert('Error generating itinerary from prompt. Please try again.');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  // API Call: Generate Itinerary from Structured Form
  async function generateItinerary(requestData) {
    showLoading('Roam AI is crafting your trip...', `Grounded places & itinerary for ${requestData.destination}`);
    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        throw new Error('Failed to generate itinerary.');
      }

      currentItinerary = await res.json();
      activeDayIndex = 0;
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert('Error generating itinerary. Please try again.');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  // API Call: Dynamic Re-plan
  async function triggerReplan(promptText) {
    if (!currentItinerary) return;
    showLoading('Roam AI is re-planning your trip...', `Updating itinerary based on: "${promptText}"`);

    const replanPayload = {
      trip_id: currentItinerary.trip_id,
      user_prompt: promptText,
      current_itinerary: currentItinerary,
      updated_preferences: userPreferences
    };

    try {
      const res = await fetch('/api/itinerary/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replanPayload)
      });

      if (!res.ok) throw new Error('Re-plan failed.');

      currentItinerary = await res.json();
      replanInput.value = '';
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert('Error re-planning itinerary.');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  // Render Itinerary Dashboard
  function renderItineraryDashboard(itinerary) {
    welcomeSection.classList.add('hidden');
    tripDashboard.classList.remove('hidden');

    document.getElementById('hero-img').src = itinerary.hero_image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80';
    document.getElementById('trip-title').textContent = itinerary.title;
    document.getElementById('trip-summary').textContent = itinerary.summary;
    document.getElementById('hero-dates').innerHTML = `<i class="fa-regular fa-calendar"></i> ${itinerary.dates}`;
    document.getElementById('hero-cost').innerHTML = `<i class="fa-solid fa-wallet"></i> ${itinerary.estimated_total_cost}`;

    const dayTabsContainer = document.getElementById('day-tabs');
    dayTabsContainer.innerHTML = '';

    itinerary.days.forEach((day, idx) => {
      const tab = document.createElement('div');
      tab.className = `day-tab ${idx === activeDayIndex ? 'active' : ''}`;
      tab.textContent = `Day ${day.day_number}`;
      tab.addEventListener('click', () => {
        activeDayIndex = idx;
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderActiveDayPlan(itinerary.days[activeDayIndex]);
      });
      dayTabsContainer.appendChild(tab);
    });

    renderActiveDayPlan(itinerary.days[activeDayIndex]);
  }

  // Render Active Day Activities
  function renderActiveDayPlan(dayPlan) {
    const container = document.getElementById('day-content-container');
    if (!dayPlan) {
      container.innerHTML = '<p>No details available for this day.</p>';
      return;
    }

    let html = `
      <div class="day-meta-card">
        <div>
          <div class="day-theme-title">Day ${dayPlan.day_number}: ${escapeHtml(dayPlan.theme)}</div>
        </div>
        <div class="day-weather-badge">
          <i class="fa-solid fa-cloud-sun"></i> ${escapeHtml(dayPlan.weather_forecast || 'Clear')}
        </div>
      </div>

      <div class="activities-timeline">
    `;

    dayPlan.activities.forEach(act => {
      const catClass = getCategoryClass(act.category);
      const placeImgUrl = act.image_url || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80';
      
      html += `
        <div class="activity-card">
          <div class="activity-img-col">
            <img src="${placeImgUrl}" alt="${escapeHtml(act.title)}" loading="lazy" />
          </div>

          <div class="activity-time-col">
            <span class="time-slot">${escapeHtml(act.time_slot)}</span>
            <span class="category-tag ${catClass}">${escapeHtml(act.category)}</span>
          </div>

          <div class="activity-main-col">
            <div class="activity-title-row">
              <h3 class="activity-title">${escapeHtml(act.title)}</h3>
              <span class="activity-rating">
                <i class="fa-solid fa-star"></i> ${act.rating || '4.8'}
              </span>
            </div>

            <p class="activity-desc">${escapeHtml(act.description)}</p>

            <div class="activity-footer-meta">
              <span class="activity-cost"><i class="fa-solid fa-tag"></i> ${escapeHtml(act.estimated_cost)}</span>
              <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(act.location_name)}</span>
              <a href="${act.google_maps_url}" target="_blank" rel="noopener" class="maps-link">
                View on Google Maps <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>

            ${act.tips ? `<div class="activity-tip-box"><i class="fa-solid fa-lightbulb"></i> <strong>Tip:</strong> ${escapeHtml(act.tips)}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // Helper Utilities
  function getCategoryClass(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('attraction') || c.includes('sight')) return 'cat-attraction';
    if (c.includes('restaurant') || c.includes('food')) return 'cat-restaurant';
    if (c.includes('cafe') || c.includes('coffee')) return 'cat-cafe';
    if (c.includes('shop')) return 'cat-shopping';
    return 'cat-relaxation';
  }

  function showModal(modal) {
    modal.classList.remove('hidden');
  }

  function hideModal(modal) {
    modal.classList.add('hidden');
  }

  function showLoading(title, subtitle) {
    loadingTitle.textContent = title;
    document.getElementById('loading-subtitle').textContent = subtitle;
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
