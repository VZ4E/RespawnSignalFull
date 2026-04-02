/**
 * AGENCY SEARCH — UI LAYER (Vanilla JS)
 * 
 * Manages DOM rendering, user interactions, and event handling.
 * Emits custom events instead of using callbacks.
 * 
 * Events fired:
 * - 'agencySearch:scrapeStarted'
 * - 'agencySearch:scrapeComplete' -> { scrapeResult }
 * - 'agencySearch:scrapeError' -> { error }
 * - 'agencySearch:saveStarted'
 * - 'agencySearch:saveComplete' -> { agency, creators }
 * - 'agencySearch:watchlistAdd' -> { creators }
 * - 'agencySearch:groupScanAdd' -> { creators, groupId }
 * - 'agencySearch:deleteAgency' -> { agencyId }
 */

class AgencySearchUI {
  constructor(containerId, config = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container #${containerId} not found`);
    }

    this.config = {
      supabaseUrl: config.supabaseUrl || window.SUPABASE_URL,
      supabaseAnonKey: config.supabaseAnonKey || window.SUPABASE_ANON_KEY,
      userId: config.userId,
      perplexityKey: config.perplexityKey,
      ...config,
    };

    if (!this.config.userId) {
      throw new Error('userId is required in config');
    }

    // Initialize Supabase client
    const { SupabaseClient } = window.AgencySearchData;
    this.db = new SupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);

    // State
    this.state = {
      agencies: [],
      selectedAgency: null,
      scrapeResult: null,
      selectedCreators: new Set(),
      isLoading: false,
      modalOpen: false,
      currentStep: 1, // 1, 2, or 3
    };

    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
    this.loadAgencies();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────────────────────────────────────

  render() {
    this.container.innerHTML = `
      <div class="agency-search-root">
        <div class="agency-search-header">
          <div>
            <h2 class="agency-search-title">Agency Search</h2>
            <p class="agency-search-subtitle">Import agencies, classify creators by niche, and manage group scans.</p>
          </div>
          <button class="agency-search-btn-primary" id="btn-add-agency">
            + Import Agency
          </button>
        </div>

        <div class="agency-search-content">
          <div id="agencies-section" class="agency-search-section">
            <h3 class="agency-search-section-title">Agencies</h3>
            <div id="agencies-list" class="agency-search-agencies-grid">
              <!-- Populated dynamically -->
            </div>
          </div>

          <div id="creators-section" class="agency-search-section" style="display: none;">
            <div class="agency-search-back-bar">
              <button id="btn-back-to-agencies" class="agency-search-btn-back">← Back to Agencies</button>
            </div>

            <h3 class="agency-search-section-title" id="creators-title"></h3>

            <div class="agency-search-filters">
              <select id="niche-filter" class="agency-search-select">
                <option value="">All Niches</option>
              </select>
              <select id="platform-filter" class="agency-search-select">
                <option value="">All Platforms</option>
              </select>
            </div>

            <table class="agency-search-table">
              <thead>
                <tr>
                  <th><input type="checkbox" id="select-all-creators"></th>
                  <th>Creator</th>
                  <th>Niche</th>
                  <th>Platform</th>
                  <th>Followers</th>
                </tr>
              </thead>
              <tbody id="creators-tbody">
                <!-- Populated dynamically -->
              </tbody>
            </table>

            <div class="agency-search-actions">
              <button id="btn-add-to-watchlist" class="agency-search-btn-secondary">
                Add Selected to Watchlist
              </button>
              <button id="btn-add-to-group-scan" class="agency-search-btn-primary">
                Add Selected to Group Scan
              </button>
            </div>
          </div>
        </div>

        <!-- Import Modal -->
        <div id="import-modal" class="agency-search-modal" style="display: none;">
          <div class="agency-search-modal-backdrop"></div>
          <div class="agency-search-modal-content">
            <div class="agency-search-modal-header">
              <h2>Import Agency</h2>
              <button id="btn-close-modal" class="agency-search-modal-close">✕</button>
            </div>

            <div class="agency-search-step-indicator" id="step-indicator"></div>

            <div class="agency-search-modal-body" id="modal-body">
              <!-- Step content populated dynamically -->
            </div>

            <div class="agency-search-modal-footer" id="modal-footer">
              <!-- Buttons populated dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    this.cacheElements();
  }

  cacheElements() {
    this.elements = {
      // Main sections
      agenciesSection: this.container.querySelector('#agencies-section'),
      agenciesList: this.container.querySelector('#agencies-list'),
      creatorsSection: this.container.querySelector('#creators-section'),
      creatorsTitle: this.container.querySelector('#creators-title'),
      creatorsTable: this.container.querySelector('.agency-search-table'),
      creatorsTbody: this.container.querySelector('#creators-tbody'),

      // Modal
      modal: this.container.querySelector('#import-modal'),
      modalBody: this.container.querySelector('#modal-body'),
      modalFooter: this.container.querySelector('#modal-footer'),
      stepIndicator: this.container.querySelector('#step-indicator'),

      // Buttons
      btnAddAgency: this.container.querySelector('#btn-add-agency'),
      btnBackToAgencies: this.container.querySelector('#btn-back-to-agencies'),
      btnCloseModal: this.container.querySelector('#btn-close-modal'),
      btnAddToWatchlist: this.container.querySelector('#btn-add-to-watchlist'),
      btnAddToGroupScan: this.container.querySelector('#btn-add-to-group-scan'),

      // Filters
      nicheFilter: this.container.querySelector('#niche-filter'),
      platformFilter: this.container.querySelector('#platform-filter'),
      selectAllCheckbox: this.container.querySelector('#select-all-creators'),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────────

  async loadAgencies() {
    this.state.isLoading = true;
    try {
      const agencies = await this.db.getAgencies(this.config.userId);
      this.state.agencies = agencies || [];

      // Load creators for each agency
      for (const agency of this.state.agencies) {
        const creators = await this.db.getCreatorsByAgency(agency.id);
        agency.creators = creators || [];
      }

      this.renderAgencies();
    } catch (err) {
      console.error('Failed to load agencies:', err);
      this.showError('Failed to load agencies: ' + err.message);
    } finally {
      this.state.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERING: AGENCIES LIST
  // ─────────────────────────────────────────────────────────────────────────────

  renderAgencies() {
    if (this.state.agencies.length === 0) {
      this.elements.agenciesList.innerHTML = `
        <div class="agency-search-empty-state">
          <div class="agency-search-empty-icon">🏢</div>
          <h3>No agencies yet</h3>
          <p>Import a talent agency to get started. Paste a URL or a list of creator handles.</p>
        </div>
      `;
      return;
    }

    const { computeNicheBreakdown, NICHE_COLORS } = window.AgencySearchData;

    this.elements.agenciesList.innerHTML = this.state.agencies
      .map((agency) => {
        const breakdown = computeNicheBreakdown(agency.creators || []);
        const topNiche = breakdown[0];

        return `
          <div class="agency-search-card" data-agency-id="${agency.id}">
            <div class="agency-search-card-header">
              <h3>${agency.name}</h3>
              <button class="agency-search-card-delete-btn" data-agency-id="${agency.id}">🗑</button>
            </div>

            <p class="agency-search-card-url">${agency.url || 'No URL'}</p>

            <div class="agency-search-card-stats">
              <span class="agency-search-card-stat">${(agency.creators || []).length} creators</span>
              <span class="agency-search-card-stat">Imported ${new Date(agency.created_at).toLocaleDateString()}</span>
            </div>

            <div class="agency-search-card-niche-breakdown">
              ${breakdown.slice(0, 3).map((item) => {
                const colors = NICHE_COLORS[item.niche];
                return `
                  <div class="agency-search-niche-badge" style="background-color: ${colors.bg}; color: ${colors.text};">
                    ${item.niche} (${item.percentage}%)
                  </div>
                `;
              }).join('')}
            </div>

            <button class="agency-search-card-view-btn" data-agency-id="${agency.id}">
              View Creators
            </button>
          </div>
        `;
      })
      .join('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERING: CREATORS TABLE
  // ─────────────────────────────────────────────────────────────────────────────

  renderCreators(creators) {
    const { NICHE_COLORS } = window.AgencySearchData;

    this.elements.creatorsTitle.textContent = `Creators (${creators.length})`;

    // Populate niche filter
    const niches = [...new Set(creators.map((c) => c.niche))];
    this.elements.nicheFilter.innerHTML = `
      <option value="">All Niches</option>
      ${niches.map((n) => `<option value="${n}">${n}</option>`).join('')}
    `;

    // Populate platform filter
    const platforms = new Set();
    creators.forEach((c) => {
      (c.platform || []).forEach((p) => platforms.add(p));
    });
    this.elements.platformFilter.innerHTML = `
      <option value="">All Platforms</option>
      ${[...platforms].map((p) => `<option value="${p}">${p}</option>`).join('')}
    `;

    // Render table rows
    const filteredCreators = this.getFilteredCreators(creators);

    this.elements.creatorsTbody.innerHTML = filteredCreators
      .map((creator) => {
        const colors = NICHE_COLORS[creator.niche];
        const isSelected = this.state.selectedCreators.has(creator.id);

        return `
          <tr data-creator-id="${creator.id}">
            <td>
              <input type="checkbox" class="creator-checkbox" value="${creator.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="agency-search-table-creator">
              <strong>@${creator.handle}</strong>
              ${creator.name ? `<br><small>${creator.name}</small>` : ''}
            </td>
            <td>
              <span class="agency-search-niche-badge" style="background-color: ${colors.bg}; color: ${colors.text};">
                ${creator.niche}
              </span>
            </td>
            <td>
              <div class="agency-search-platforms">
                ${(creator.platform || []).map((p) => `<span class="agency-search-platform">${p}</span>`).join('')}
              </div>
            </td>
            <td>
              ${creator.follower_count_formatted || creator.follower_count || '—'}
            </td>
          </tr>
        `;
      })
      .join('');
  }

  getFilteredCreators(creators) {
    const nicheFilter = this.elements.nicheFilter.value;
    const platformFilter = this.elements.platformFilter.value;

    return creators.filter((c) => {
      if (nicheFilter && c.niche !== nicheFilter) return false;
      if (platformFilter && !(c.platform || []).includes(platformFilter)) return false;
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL: IMPORT FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  openImportModal() {
    this.state.modalOpen = true;
    this.state.currentStep = 1;
    this.state.scrapeResult = null;
    this.state.selectedCreators.clear();
    this.elements.modal.style.display = 'flex';
    this.renderModalStep();
  }

  closeImportModal() {
    this.state.modalOpen = false;
    this.elements.modal.style.display = 'none';
    this.state.scrapeResult = null;
  }

  renderModalStep() {
    const step = this.state.currentStep;

    // Render step indicator
    this.elements.stepIndicator.innerHTML = `
      <div class="agency-search-steps">
        ${[1, 2, 3].map((s) => `
          <div class="agency-search-step ${s < step ? 'done' : s === step ? 'active' : ''}">
            <span class="agency-search-step-num">${s < step ? '✓' : s}</span>
            <span class="agency-search-step-label">${['Import Source', 'Review Creators', 'Save & Organize'][s - 1]}</span>
          </div>
        `).join('')}
      </div>
    `;

    if (step === 1) {
      this.renderStep1();
    } else if (step === 2) {
      this.renderStep2();
    } else if (step === 3) {
      this.renderStep3();
    }
  }

  renderStep1() {
    this.elements.modalBody.innerHTML = `
      <div class="agency-search-step-form">
        <div class="agency-search-form-group">
          <label class="agency-search-form-label">
            <input type="radio" name="input-type" value="url" checked> 🌐 Agency URL
          </label>
          <label class="agency-search-form-label">
            <input type="radio" name="input-type" value="handles"> @ Creator Handles
          </label>
        </div>

        <textarea
          id="step1-input"
          class="agency-search-textarea"
          placeholder="Paste agency URL or creator handles..."
          rows="6"
        ></textarea>

        <small class="agency-search-form-hint">
          URL: https://agency.com/talent<br>
          Handles: @creator1, @creator2, @creator3 (one per line or comma-separated)
        </small>

        <div id="step1-error" class="agency-search-error" style="display: none;"></div>
      </div>
    `;

    this.elements.modalFooter.innerHTML = `
      <button id="btn-modal-cancel" class="agency-search-btn-secondary">Cancel</button>
      <button id="btn-modal-next" class="agency-search-btn-primary">Find Creators</button>
    `;

    this.container.querySelector('#btn-modal-cancel').onclick = () => this.closeImportModal();
    this.container.querySelector('#btn-modal-next').onclick = () => this.handleStep1Submit();
  }

  async handleStep1Submit() {
    const inputType = this.container.querySelector('input[name="input-type"]:checked').value;
    const input = this.container.querySelector('#step1-input').value.trim();
    const errorEl = this.container.querySelector('#step1-error');

    if (!input) {
      errorEl.textContent = 'Please enter a URL or creator handles.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    // Disable button
    const btnNext = this.container.querySelector('#btn-modal-next');
    btnNext.disabled = true;
    btnNext.textContent = 'Scraping...';

    try {
      const { scrapeAgencyUrl, enrichCreatorHandles, getMockScrapeResult } = window.AgencySearchData;

      let result;
      if (!this.config.perplexityKey) {
        console.warn('No Perplexity API key — using mock data');
        result = getMockScrapeResult(input);
      } else if (inputType === 'url') {
        result = await scrapeAgencyUrl(input, this.config.perplexityKey);
      } else {
        const handles = input.split(/[\n,]+/).map((h) => h.trim().replace('@', '')).filter(Boolean);
        result = await enrichCreatorHandles(handles, this.config.perplexityKey);
      }

      this.state.scrapeResult = result;
      this.state.currentStep = 2;
      this.renderModalStep();
    } catch (err) {
      errorEl.textContent = 'Scrape failed: ' + err.message;
      errorEl.style.display = 'block';
      btnNext.disabled = false;
      btnNext.textContent = 'Find Creators';
    }
  }

  renderStep2() {
    const { creators } = this.state.scrapeResult;
    const { NICHE_COLORS } = window.AgencySearchData;

    const creatorsHtml = creators
      .map((c) => {
        const colors = NICHE_COLORS[c.niche];
        const isSelected = this.state.selectedCreators.has(c.handle);
        return `
          <label class="agency-search-step2-creator" style="border-left: 4px solid ${colors.dot};">
            <input type="checkbox" class="step2-creator-checkbox" value="${c.handle}" ${isSelected ? 'checked' : ''}>
            <div>
              <strong>@${c.handle}</strong>
              ${c.name ? ` — ${c.name}` : ''}
              <br>
              <small style="color: ${colors.text}; background: ${colors.bg}; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 4px;">
                ${c.niche}
              </small>
              ${(c.platform || []).map((p) => `<span class="agency-search-platform">${p}</span>`).join('')}
              ${c.followerCountFormatted ? `<span class="agency-search-followers">${c.followerCountFormatted}</span>` : ''}
            </div>
          </label>
        `;
      })
      .join('');

    this.elements.modalBody.innerHTML = `
      <div class="agency-search-step-form">
        <div class="agency-search-form-group">
          <label class="agency-search-form-label">
            <input type="checkbox" id="step2-select-all"> Select All (${creators.length})
          </label>
        </div>

        <div class="agency-search-creators-list">
          ${creatorsHtml}
        </div>
      </div>
    `;

    this.elements.modalFooter.innerHTML = `
      <button id="btn-modal-back" class="agency-search-btn-secondary">Back</button>
      <button id="btn-modal-cancel" class="agency-search-btn-secondary">Cancel</button>
      <button id="btn-modal-next" class="agency-search-btn-primary">Continue</button>
    `;

    // Event listeners
    this.container.querySelector('#step2-select-all').onchange = (e) => {
      this.container.querySelectorAll('.step2-creator-checkbox').forEach((cb) => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          this.state.selectedCreators.add(cb.value);
        } else {
          this.state.selectedCreators.delete(cb.value);
        }
      });
    };

    this.container.querySelectorAll('.step2-creator-checkbox').forEach((cb) => {
      cb.onchange = (e) => {
        if (e.target.checked) {
          this.state.selectedCreators.add(e.target.value);
        } else {
          this.state.selectedCreators.delete(e.target.value);
        }
      };
    });

    this.container.querySelector('#btn-modal-back').onclick = () => {
      this.state.currentStep = 1;
      this.renderModalStep();
    };

    this.container.querySelector('#btn-modal-cancel').onclick = () => this.closeImportModal();
    this.container.querySelector('#btn-modal-next').onclick = () => {
      this.state.currentStep = 3;
      this.renderModalStep();
    };
  }

  renderStep3() {
    const selectedCount = this.state.selectedCreators.size;

    this.elements.modalBody.innerHTML = `
      <div class="agency-search-step-form">
        <div class="agency-search-summary">
          <h3>${this.state.scrapeResult.agencyName}</h3>
          <p>${this.state.scrapeResult.agencyUrl || 'No URL'}</p>
          <p><strong>${selectedCount} creators selected</strong> (of ${this.state.scrapeResult.creators.length})</p>
        </div>

        <div class="agency-search-form-group">
          <label class="agency-search-form-label">
            Agency Name
            <input type="text" id="step3-agency-name" class="agency-search-input" value="${this.state.scrapeResult.agencyName}" />
          </label>
        </div>

        <p class="agency-search-form-hint">Ready to save. You can scan creators immediately after.</p>
      </div>
    `;

    this.elements.modalFooter.innerHTML = `
      <button id="btn-modal-back" class="agency-search-btn-secondary">Back</button>
      <button id="btn-modal-cancel" class="agency-search-btn-secondary">Cancel</button>
      <button id="btn-modal-save" class="agency-search-btn-primary">Save & Import</button>
    `;

    this.container.querySelector('#btn-modal-back').onclick = () => {
      this.state.currentStep = 2;
      this.renderModalStep();
    };

    this.container.querySelector('#btn-modal-cancel').onclick = () => this.closeImportModal();
    this.container.querySelector('#btn-modal-save').onclick = () => this.handleStep3Submit();
  }

  async handleStep3Submit() {
    const agencyName = this.container.querySelector('#step3-agency-name').value || this.state.scrapeResult.agencyName;
    const selectedHandles = Array.from(this.state.selectedCreators);
    const selectedCreators = this.state.scrapeResult.creators.filter((c) => selectedHandles.includes(c.handle));

    const btnSave = this.container.querySelector('#btn-modal-save');
    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    try {
      // Create agency
      const [newAgency] = await this.db.createAgency(
        agencyName,
        this.state.scrapeResult.agencyUrl,
        this.config.userId
      );

      // Upsert creators
      await this.db.upsertCreators(newAgency.id, selectedCreators);

      // Update state
      newAgency.creators = selectedCreators;
      this.state.agencies.push(newAgency);

      // Emit event
      window.dispatchEvent(
        new CustomEvent('agencySearch:saveComplete', {
          detail: { agency: newAgency, creators: selectedCreators },
        })
      );

      this.closeImportModal();
      this.renderAgencies();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save: ' + err.message);
      btnSave.disabled = false;
      btnSave.textContent = 'Save & Import';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────────

  attachEventListeners() {
    // Add agency button
    this.elements.btnAddAgency.onclick = () => this.openImportModal();
    this.elements.btnCloseModal.onclick = () => this.closeImportModal();

    // Back to agencies
    this.elements.btnBackToAgencies.onclick = () => {
      this.state.selectedAgency = null;
      this.elements.creatorsSection.style.display = 'none';
      this.elements.agenciesSection.style.display = 'block';
      this.state.selectedCreators.clear();
    };

    // View agency details
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.agency-search-card-view-btn')) {
        const agencyId = e.target.closest('.agency-search-card-view-btn').dataset.agencyId;
        const agency = this.state.agencies.find((a) => a.id === agencyId);
        if (agency) {
          this.state.selectedAgency = agency;
          this.elements.agenciesSection.style.display = 'none';
          this.elements.creatorsSection.style.display = 'block';
          this.renderCreators(agency.creators || []);
        }
      }

      // Delete agency
      if (e.target.closest('.agency-search-card-delete-btn')) {
        const agencyId = e.target.closest('.agency-search-card-delete-btn').dataset.agencyId;
        if (confirm('Delete this agency and all its creators?')) {
          this.deleteAgency(agencyId);
        }
      }
    });

    // Filters
    this.elements.nicheFilter.onchange = () => {
      if (this.state.selectedAgency) {
        this.renderCreators(this.state.selectedAgency.creators || []);
      }
    };

    this.elements.platformFilter.onchange = () => {
      if (this.state.selectedAgency) {
        this.renderCreators(this.state.selectedAgency.creators || []);
      }
    };

    // Select all creators
    this.elements.selectAllCheckbox.onchange = (e) => {
      const filtered = this.getFilteredCreators(this.state.selectedAgency.creators || []);
      filtered.forEach((c) => {
        if (e.target.checked) {
          this.state.selectedCreators.add(c.id);
        } else {
          this.state.selectedCreators.delete(c.id);
        }
      });
      this.updateCreatorCheckboxes();
    };

    // Creator checkboxes
    this.container.addEventListener('change', (e) => {
      if (e.target.closest('.creator-checkbox')) {
        const creatorId = e.target.value;
        if (e.target.checked) {
          this.state.selectedCreators.add(creatorId);
        } else {
          this.state.selectedCreators.delete(creatorId);
        }
        this.updateSelectAllCheckbox();
      }
    });

    // Watchlist button
    this.elements.btnAddToWatchlist.onclick = () => this.addToWatchlist();

    // Group scan button
    this.elements.btnAddToGroupScan.onclick = () => this.addToGroupScan();
  }

  updateCreatorCheckboxes() {
    this.container.querySelectorAll('.creator-checkbox').forEach((cb) => {
      cb.checked = this.state.selectedCreators.has(cb.value);
    });
  }

  updateSelectAllCheckbox() {
    const filtered = this.getFilteredCreators(this.state.selectedAgency.creators || []);
    const allChecked = filtered.every((c) => this.state.selectedCreators.has(c.id));
    this.elements.selectAllCheckbox.checked = allChecked;
  }

  async deleteAgency(agencyId) {
    try {
      await this.db.deleteAgency(agencyId);
      this.state.agencies = this.state.agencies.filter((a) => a.id !== agencyId);
      this.renderAgencies();

      window.dispatchEvent(
        new CustomEvent('agencySearch:deleteAgency', { detail: { agencyId } })
      );
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete: ' + err.message);
    }
  }

  async addToWatchlist() {
    if (this.state.selectedCreators.size === 0) {
      alert('Select at least one creator');
      return;
    }

    const selectedCreators = (this.state.selectedAgency.creators || []).filter((c) =>
      this.state.selectedCreators.has(c.id)
    );

    try {
      for (const creator of selectedCreators) {
        await this.db.addToWatchlist(this.config.userId, creator.id);
      }

      window.dispatchEvent(
        new CustomEvent('agencySearch:watchlistAdd', { detail: { creators: selectedCreators } })
      );

      alert(`Added ${selectedCreators.length} creators to watchlist`);
      this.state.selectedCreators.clear();
      this.updateCreatorCheckboxes();
    } catch (err) {
      console.error('Watchlist failed:', err);
      alert('Failed to add to watchlist: ' + err.message);
    }
  }

  async addToGroupScan() {
    if (this.state.selectedCreators.size === 0) {
      alert('Select at least one creator');
      return;
    }

    const selectedCreators = (this.state.selectedAgency.creators || []).filter((c) =>
      this.state.selectedCreators.has(c.id)
    );

    const groupName = prompt('Enter group scan name:', `${this.state.selectedAgency.name} - ${new Date().toLocaleDateString()}`);
    if (!groupName) return;

    try {
      const [newGroup] = await this.db.createGroup(groupName, this.config.userId);
      const creatorIds = selectedCreators.map((c) => c.id);
      await this.db.addCreatorsToGroup(newGroup.id, creatorIds);

      window.dispatchEvent(
        new CustomEvent('agencySearch:groupScanAdd', {
          detail: { creators: selectedCreators, groupId: newGroup.id, groupName },
        })
      );

      alert(`Created group "${groupName}" with ${selectedCreators.length} creators`);
      this.state.selectedCreators.clear();
      this.updateCreatorCheckboxes();
    } catch (err) {
      console.error('Group scan failed:', err);
      alert('Failed to create group: ' + err.message);
    }
  }

  showError(message) {
    alert(message);
  }
}

// Export
window.AgencySearchUI = AgencySearchUI;
