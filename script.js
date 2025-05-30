// script.js (Main website JavaScript)

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const MOVIES_STORAGE_KEY = 'teluguMovies_movies_v9_githubJson_r1'; // Key for localStorage
    const HEROES_STORAGE_KEY = 'teluguMovies_heroes_v9_githubJson_r1'; // Key for localStorage

    // ===================================================================================
    // IMPORTANT: REPLACE THESE URLs WITH YOUR ACTUAL CLOUDFLARE WORKER URLs
    // Option 1: If you set up custom routes (e.g., yourdomain.com/api/movies)
    // const MOVIES_DATA_URL = 'https://youractualdomain.com/api/movies';
    // const HEROES_DATA_URL = 'https://youractualdomain.com/api/heroes';

    // Option 2: If you are using the direct *.workers.dev URL
    const MOVIES_DATA_URL = 'https://mana-hero-movies.digimoviesvault.workers.dev/movies';
    const HEROES_DATA_URL = 'https://mana-hero-movies.digimoviesvault.workers.dev/heroes';
    // ===================================================================================


    const MOVIES_PER_PAGE = 12;
    const SCROLL_THRESHOLD = 300; // Pixels from bottom to trigger load
    const SEARCH_DEBOUNCE_MS = 350;
    const LOAD_MORE_DELAY_MS = 50; // Small delay for visual feedback of loading
    const HERO_SEARCH_DEBOUNCE_MS = 200;
    const YEAR_SEARCH_DEBOUNCE_MS = 200;

    // --- DOM Element References ---
    const movieGrid = document.getElementById('movie-grid');
    const searchInput = document.getElementById('search-input');
    const sortBySelect = document.getElementById('sort-by-select');
    const randomMovieBtn = document.getElementById('random-movie-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const logoLink = document.getElementById('logo-link');
    const footerYear = document.getElementById('footer-year');

    const customHeroSelectWrapper = document.getElementById('custom-hero-select-wrapper');
    const heroSelectTrigger = document.getElementById('custom-hero-select-trigger');
    const selectedHeroNameDisplay = document.getElementById('selected-hero-name-display');
    const heroOptionsPanel = document.getElementById('hero-options-panel');
    const heroOptionsSearchInput = document.getElementById('hero-options-search-input');
    const heroOptionsList = document.getElementById('hero-options-list');
    const selectedHeroIdHidden = document.getElementById('selected-hero-id-hidden');

    const customYearSelectWrapper = document.getElementById('custom-year-select-wrapper');
    const yearSelectTrigger = document.getElementById('custom-year-select-trigger');
    const selectedYearNameDisplay = document.getElementById('selected-year-name-display');
    const yearOptionsPanel = document.getElementById('year-options-panel');
    const yearOptionsSearchInput = document.getElementById('year-options-search-input');
    const yearOptionsList = document.getElementById('year-options-list');
    const selectedYearHidden = document.getElementById('selected-year-hidden');

    // --- State Variables ---
    let allMovies = []; // Raw movies from fetch/localStorage
    let allHeroes = []; // Raw heroes from fetch/localStorage
    let processedMovies = []; // Movies after processMovieData()
    let currentFilteredMovies = []; // Movies currently matching filters/search
    let currentPage = 1;
    let isLoading = false; // Flag to prevent multiple simultaneous loads
    let searchTimeout;
    let heroSearchTimeout;
    let yearSearchTimeout;
    let currentFocusedHeroOptionIndex = -1;
    let currentFocusedYearOptionIndex = -1;
    let allAvailableYears = []; // Unique years extracted from movie data

    const placeholderThumb = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22320%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20320%20180%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3Argba(255%2C255%2C255%2C.75)%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A16pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%22320%22%20height%3D%22180%22%20fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22119%22%20y%3D%2297.5%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';

    // --- Helper Functions ---
    function loadDataFromStorage(key, fallback = []) {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                const parsedData = JSON.parse(data);
                return Array.isArray(parsedData) ? parsedData : fallback;
            }
            return fallback;
        } catch (error) {
            console.error(`Error loading ${key} from localStorage:`, error);
            localStorage.removeItem(key); // Clear corrupted data
            return fallback;
        }
    }

    function processMovieData(moviesArray) {
        if (!Array.isArray(moviesArray)) return [];
        return moviesArray.map(movie => ({
            // Ensure all expected properties exist, provide defaults
            id: movie.id || `movie-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            title: movie.title || 'Untitled Movie',
            thumbnailUrl: movie.thumbnailUrl || placeholderThumb,
            heroId: movie.heroId || null, // Default to null if not present
            redirectUrl: movie.redirectUrl || '#', // Default to '#' if not present
            year: movie.year ? parseInt(movie.year, 10) : 0 // Ensure year is a number
        })).filter(movie => movie.redirectUrl && movie.thumbnailUrl && movie.thumbnailUrl !== placeholderThumb); // Basic validation
    }

    function normalizeSearchString(str) {
        if (typeof str !== 'string') return '';
        return str.toLowerCase().replace(/[\s.]+/g, ''); // Remove spaces and dots for matching
    }

    // --- Custom Hero Select Functions ---
    function populateHeroOptions(heroesToList = allHeroes, searchTerm = '', currentSelectedId = '') {
        if (!heroOptionsList) return;
        heroOptionsList.innerHTML = '';
        const normalizedSearchTerm = normalizeSearchString(searchTerm);
        const filteredHeroes = normalizedSearchTerm
            ? heroesToList.filter(hero => hero.name && normalizeSearchString(hero.name).includes(normalizedSearchTerm))
            : heroesToList;

        const allHeroesOption = document.createElement('li');
        allHeroesOption.textContent = "All Hero Movies";
        allHeroesOption.dataset.value = "";
        allHeroesOption.setAttribute('role', 'option');
        if (currentSelectedId === "") allHeroesOption.classList.add('selected-option');
        allHeroesOption.addEventListener('click', () => selectHeroOption(allHeroesOption));
        heroOptionsList.appendChild(allHeroesOption);

        if (filteredHeroes.length > 0) {
            filteredHeroes.forEach(hero => {
                const option = document.createElement('li');
                option.textContent = hero.name; // Assumes hero object has 'name'
                option.dataset.value = hero.id;  // Assumes hero object has 'id'
                option.setAttribute('role', 'option');
                if (String(hero.id) === String(currentSelectedId)) option.classList.add('selected-option');
                option.addEventListener('click', () => selectHeroOption(option));
                heroOptionsList.appendChild(option);
            });
        } else if (searchTerm) {
            const noResultsLi = document.createElement('li');
            noResultsLi.textContent = `No heroes found matching "${searchTerm}"`;
            noResultsLi.classList.add('no-hero-results');
            heroOptionsList.appendChild(noResultsLi);
        }
        if (heroOptionsPanel.classList.contains('open')) {
            currentFocusedHeroOptionIndex = Array.from(heroOptionsList.children).findIndex(li => li.classList.contains('selected-option'));
             if (currentFocusedHeroOptionIndex === -1 && heroOptionsList.children.length > 0 && !heroOptionsList.querySelector('.no-hero-results')) {
                currentFocusedHeroOptionIndex = 0;
            }
            updateFocusedHeroOption(false); // Don't scroll initially when populating
        }
    }

     function selectHeroOption(optionElement) {
        const heroId = optionElement.dataset.value;
        const heroName = optionElement.textContent;
        selectedHeroNameDisplay.textContent = heroName;
        selectedHeroIdHidden.value = heroId;
        heroOptionsList.querySelectorAll('li.selected-option').forEach(li => li.classList.remove('selected-option'));
        optionElement.classList.add('selected-option');
        closeHeroOptionsPanel();
        resetAndLoadMovies();
    }

    function toggleHeroOptionsPanel() {
        const isOpen = heroOptionsPanel.classList.toggle('open');
        heroSelectTrigger.classList.toggle('open', isOpen);
        heroSelectTrigger.setAttribute('aria-expanded', String(isOpen));
        heroOptionsPanel.setAttribute('aria-hidden', String(!isOpen));
        if (isOpen) {
            closeYearOptionsPanel(); // Close other custom select if open
            heroOptionsSearchInput.value = ''; // Clear search
            populateHeroOptions(allHeroes, '', selectedHeroIdHidden.value); // Repopulate
            heroOptionsSearchInput.focus();
            // Set focus to currently selected or first item
            currentFocusedHeroOptionIndex = Array.from(heroOptionsList.children).findIndex(li => li.classList.contains('selected-option') || li.dataset.value === selectedHeroIdHidden.value);
            if (currentFocusedHeroOptionIndex === -1 && heroOptionsList.children.length > 0 && !heroOptionsList.querySelector('.no-hero-results')) {
                currentFocusedHeroOptionIndex = 0;
            }
            updateFocusedHeroOption(false); // Update visual focus without scrolling initially
        }
    }

    function closeHeroOptionsPanel() {
        if (heroOptionsPanel.classList.contains('open')) {
            heroOptionsPanel.classList.remove('open');
            heroSelectTrigger.classList.remove('open');
            heroSelectTrigger.setAttribute('aria-expanded', 'false');
            heroOptionsPanel.setAttribute('aria-hidden', 'true');
        }
    }

    function updateFocusedHeroOption(scroll = true) {
        const options = Array.from(heroOptionsList.children).filter(li => !li.classList.contains('no-hero-results'));
        if (options.length === 0) return; // No options to focus
        currentFocusedHeroOptionIndex = Math.max(0, Math.min(currentFocusedHeroOptionIndex, options.length - 1)); // Clamp index

        options.forEach((opt, idx) => {
            opt.classList.remove('focused');
            if (idx === currentFocusedHeroOptionIndex) {
                opt.classList.add('focused');
                opt.setAttribute('aria-selected', 'true');
                if (!opt.id) opt.id = `hero-option-${idx}`; // Ensure ID for aria-activedescendant
                heroOptionsList.setAttribute('aria-activedescendant', opt.id);
                if (scroll) {
                    opt.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            } else {
                opt.removeAttribute('aria-selected');
            }
        });
    }

    // --- Custom Year Select Functions ---
    function populateAllAvailableYears(moviesArray) {
        if (!Array.isArray(moviesArray)) return;
        const years = [...new Set(moviesArray.map(movie => movie.year).filter(year => year > 0))]
            .sort((a, b) => b - a); // Descending order
        allAvailableYears = years.map(String); // Store as strings
    }

    function populateYearOptions(yearsToList = allAvailableYears, searchTerm = '', currentSelectedValue = '') {
        if (!yearOptionsList) return;
        yearOptionsList.innerHTML = '';
        const normalizedSearchTerm = String(searchTerm).toLowerCase().trim();

        const filteredYears = normalizedSearchTerm
            ? yearsToList.filter(year => String(year).includes(normalizedSearchTerm))
            : yearsToList;

        const allYearsOption = document.createElement('li');
        allYearsOption.textContent = "All Years";
        allYearsOption.dataset.value = "";
        allYearsOption.setAttribute('role', 'option');
        if (currentSelectedValue === "") allYearsOption.classList.add('selected-option');
        allYearsOption.addEventListener('click', () => selectYearOption(allYearsOption));
        yearOptionsList.appendChild(allYearsOption);

        if (filteredYears.length > 0) {
            filteredYears.forEach(year => {
                const option = document.createElement('li');
                option.textContent = String(year);
                option.dataset.value = String(year);
                option.setAttribute('role', 'option');
                if (String(year) === currentSelectedValue) option.classList.add('selected-option');
                option.addEventListener('click', () => selectYearOption(option));
                yearOptionsList.appendChild(option);
            });
        } else if (searchTerm) {
            const noResultsLi = document.createElement('li');
            noResultsLi.textContent = `No years found matching "${searchTerm}"`;
            noResultsLi.classList.add('no-year-results');
            yearOptionsList.appendChild(noResultsLi);
        }

        if (yearOptionsPanel.classList.contains('open')) {
            currentFocusedYearOptionIndex = Array.from(yearOptionsList.children)
                .findIndex(li => li.dataset.value === currentSelectedValue && !li.classList.contains('no-year-results'));
            if (currentFocusedYearOptionIndex === -1 && yearOptionsList.children.length > 0 && !yearOptionsList.querySelector('.no-year-results')) {
                currentFocusedYearOptionIndex = 0; // Default to first valid option ("All Years" if no value selected)
            }
            updateFocusedYearOption(false); // Don't scroll initially
        }
    }

    function selectYearOption(optionElement) {
        const yearValue = optionElement.dataset.value;
        const yearName = optionElement.textContent;

        selectedYearHidden.value = yearValue;
        selectedYearNameDisplay.textContent = yearName;
        // yearOptionsSearchInput.value = yearValue; // Optional: Sync search input with selection, but might be annoying if user wants to type more

        yearOptionsList.querySelectorAll('li.selected-option').forEach(li => li.classList.remove('selected-option'));
        optionElement.classList.add('selected-option');

        closeYearOptionsPanel();
        resetAndLoadMovies();
    }

    function toggleYearOptionsPanel() {
        const isOpen = yearOptionsPanel.classList.toggle('open');
        yearSelectTrigger.classList.toggle('open', isOpen);
        yearSelectTrigger.setAttribute('aria-expanded', String(isOpen));
        yearOptionsPanel.setAttribute('aria-hidden', String(!isOpen));
        if (isOpen) {
            closeHeroOptionsPanel(); // Close other custom select
            populateYearOptions(allAvailableYears, yearOptionsSearchInput.value, selectedYearHidden.value);
            yearOptionsSearchInput.focus();

            let focusIndex = Array.from(yearOptionsList.children).findIndex(li => li.classList.contains('selected-option') || li.dataset.value === selectedYearHidden.value);
            if (focusIndex === -1 && selectedYearHidden.value === "") { // "All Years" option
                focusIndex = Array.from(yearOptionsList.children).findIndex(li => li.dataset.value === "");
            }
            if (focusIndex === -1 && yearOptionsList.children.length > 0 && !yearOptionsList.querySelector('.no-year-results')) {
                focusIndex = 0; // Default to first actual item if no match
            }
            currentFocusedYearOptionIndex = (focusIndex !== -1) ? focusIndex : 0;
            updateFocusedYearOption(false); // Don't scroll initially
        }
    }

    function closeYearOptionsPanel() {
        if (yearOptionsPanel.classList.contains('open')) {
            yearOptionsPanel.classList.remove('open');
            yearSelectTrigger.classList.remove('open');
            yearSelectTrigger.setAttribute('aria-expanded', 'false');
            yearOptionsPanel.setAttribute('aria-hidden', 'true');
        }
    }

    function updateFocusedYearOption(scroll = true) {
        const options = Array.from(yearOptionsList.children).filter(li => !li.classList.contains('no-year-results'));
        if (options.length === 0) return;
        currentFocusedYearOptionIndex = Math.max(0, Math.min(currentFocusedYearOptionIndex, options.length - 1));

        options.forEach((opt, idx) => {
            opt.classList.remove('focused');
            if (idx === currentFocusedYearOptionIndex) {
                opt.classList.add('focused');
                opt.setAttribute('aria-selected', 'true');
                if (!opt.id) opt.id = `year-option-${idx}`;
                yearOptionsList.setAttribute('aria-activedescendant', opt.id);
                if (scroll) {
                    opt.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            } else {
                opt.removeAttribute('aria-selected');
            }
        });
    }

    // --- Movie Display and Loading ---
    function createMovieItemElement(movieData) {
        const movieElement = document.createElement('a');
        movieElement.className = 'movie-item';
        movieElement.href = movieData.redirectUrl || '#'; // Default to '#' if no redirectUrl
        movieElement.target = '_blank';
        movieElement.rel = 'noopener noreferrer';
        movieElement.dataset.movieId = movieData.id;

        let ariaLabelText = `View ${movieData.title || 'movie'}`;
        try {
            if (movieData.redirectUrl && movieData.redirectUrl !== '#') {
                const hostname = new URL(movieData.redirectUrl).hostname;
                ariaLabelText += ` on ${hostname}`;
            }
        } catch (e) { /* Ignore invalid URL for hostname extraction */ }
        movieElement.setAttribute('aria-label', ariaLabelText);

        movieElement.innerHTML = `
            <div class="thumbnail-container">
                <img src="${movieData.thumbnailUrl}" alt="Thumbnail for ${movieData.title || 'Unknown Movie'}" class="movie-thumbnail" loading="lazy" onerror="this.onerror=null; this.src='${placeholderThumb}'; this.parentElement.style.backgroundColor='#ccc';">
            </div>
            <div class="movie-details">
                <h3 class="movie-title">${movieData.title || 'Untitled Movie'}</h3>
                <p class="movie-year" style="font-size:0.8em; color: var(--text-secondary);">${movieData.year > 0 ? movieData.year : ''}</p>
            </div>`;
        return movieElement;
    }

    function displayMovies(moviesToDisplay) {
        if (!movieGrid || !Array.isArray(moviesToDisplay)) return;
        const fragment = document.createDocumentFragment();
        moviesToDisplay.forEach(movie => fragment.appendChild(createMovieItemElement(movie)));
        movieGrid.appendChild(fragment);
    }

    function showLoadingIndicator(show) {
        if (!loadingIndicator) return;
        loadingIndicator.classList.toggle('visible', show);
    }

    function loadMoreMovies() {
        if (isLoading || !currentFilteredMovies || currentFilteredMovies.length === 0) return;

        const startIndex = (currentPage - 1) * MOVIES_PER_PAGE;
        if (startIndex >= currentFilteredMovies.length) {
            showLoadingIndicator(false); // No more movies to load
            return;
        }

        isLoading = true;
        showLoadingIndicator(true);
        const moviesToLoad = currentFilteredMovies.slice(startIndex, startIndex + MOVIES_PER_PAGE);

        // Simulate network delay for smoother UX if needed, or just render
        setTimeout(() => {
            displayMovies(moviesToLoad);
            currentPage++;
            isLoading = false;
            // Show indicator if there are potentially more movies
            showLoadingIndicator((currentPage - 1) * MOVIES_PER_PAGE < currentFilteredMovies.length);
        }, LOAD_MORE_DELAY_MS);
    }

    function resetAndLoadMovies() {
        const currentSearchTerm = searchInput.value;
        const heroIdFromFilter = selectedHeroIdHidden.value;
        const yearFromFilter = selectedYearHidden.value;
        const sortBy = sortBySelect.value;

        if (!movieGrid) return;
        movieGrid.innerHTML = ''; // Clear current grid
        currentPage = 1;
        isLoading = false;
        showLoadingIndicator(false);

        let moviesToConsider = [...processedMovies]; // Start with processed (and therefore structured) movies

        // Apply Hero Filter
        if (heroIdFromFilter) {
            moviesToConsider = moviesToConsider.filter(movie => String(movie.heroId) === String(heroIdFromFilter));
            const hero = allHeroes.find(h => String(h.id) === String(heroIdFromFilter));
            if (searchInput) searchInput.placeholder = hero ? `Search ${hero.name}'s movies...` : "Search hero's movies...";
        } else {
            if (searchInput) searchInput.placeholder = "Search all movies by title...";
        }

        // Apply Year Filter
        if (yearFromFilter) {
            moviesToConsider = moviesToConsider.filter(movie => String(movie.year).startsWith(String(yearFromFilter)));
        }

        // Apply Search Term Filter
        const lowerSearchTerm = currentSearchTerm.toLowerCase().trim();
        if (lowerSearchTerm) {
            moviesToConsider = moviesToConsider.filter(movie =>
                movie.title && movie.title.toLowerCase().includes(lowerSearchTerm)
            );
        }

        // Apply Sorting
        switch (sortBy) {
            case 'title_asc': moviesToConsider.sort((a, b) => (a.title || "").localeCompare(b.title || "")); break;
            case 'title_desc': moviesToConsider.sort((a, b) => (b.title || "").localeCompare(a.title || "")); break;
            case 'year_desc': moviesToConsider.sort((a, b) => (b.year || 0) - (a.year || 0) || (a.title || "").localeCompare(b.title || "")); break;
            case 'year_asc': moviesToConsider.sort((a, b) => (a.year || 0) - (b.year || 0) || (a.title || "").localeCompare(b.title || "")); break;
        }

        currentFilteredMovies = moviesToConsider;

        if (currentFilteredMovies.length === 0) {
            movieGrid.innerHTML = `<p class="no-results">No movies found matching your criteria.</p>`;
        } else {
            loadMoreMovies(); // Load the first page of filtered movies
        }
    }

    function handleRandomMovie() {
        if (!randomMovieBtn || !currentFilteredMovies || currentFilteredMovies.length === 0) return;
        const randomIndex = Math.floor(Math.random() * currentFilteredMovies.length);
        const randomMovie = currentFilteredMovies[randomIndex];

        if (randomMovie && randomMovie.id) {
            const movieElement = movieGrid.querySelector(`.movie-item[data-movie-id="${randomMovie.id}"]`);
            if (movieElement) {
                movieGrid.querySelectorAll('.movie-item.highlighted').forEach(el => el.classList.remove('highlighted'));
                movieElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { // Apply highlight after scroll settles
                    movieElement.classList.add('highlighted');
                    setTimeout(() => movieElement.classList.remove('highlighted'), 1500); // Remove highlight after a bit
                }, 300);
            } else {
                // If movie is not yet rendered due to pagination
                alert(`Let's watch: ${randomMovie.title}! (It might be on a later page, scroll down or try Random again).`);
            }
        }
    }

    // --- Scroll Handling ---
    let scrollTimeout;
    const throttledScrollHandler = () => {
        if (scrollTimeout) return; // If a timeout is already set, do nothing
        scrollTimeout = setTimeout(() => {
            if (!isLoading && (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - SCROLL_THRESHOLD)) {
                if ((currentPage - 1) * MOVIES_PER_PAGE < currentFilteredMovies.length) {
                    loadMoreMovies();
                }
            }
            scrollTimeout = null; // Clear the timeout so it can be set again
        }, 100); // Throttle scroll checks to every 100ms
    };

    // --- Application Initialization ---
    async function initializeApp() {
        if (footerYear) footerYear.textContent = new Date().getFullYear();

        let fetchedMovies = [];
        let fetchedHeroes = [];
        let fetchError = false;

        try {
            console.log("Attempting to fetch data from Cloudflare Worker (origin: GitHub JSON)...");
            console.log(`Movies URL: ${MOVIES_DATA_URL}`);
            console.log(`Heroes URL: ${HEROES_DATA_URL}`);

            // Fetch both data sources concurrently
            const [moviesResponse, heroesResponse] = await Promise.all([
                fetch(MOVIES_DATA_URL),
                fetch(HEROES_DATA_URL)
            ]);

            let errorMessages = [];
            if (!moviesResponse.ok) {
                errorMessages.push(`Movies JSON (Status: ${moviesResponse.status}, URL: ${MOVIES_DATA_URL})`);
            }
            if (!heroesResponse.ok) {
                errorMessages.push(`Heroes JSON (Status: ${heroesResponse.status}, URL: ${HEROES_DATA_URL})`);
            }

            if (errorMessages.length > 0) {
                throw new Error(`Network response was not ok for: ${errorMessages.join('; ')}.`);
            }

            // Data from Worker is already JSON
            fetchedMovies = await moviesResponse.json();
            fetchedHeroes = await heroesResponse.json();

            // Basic validation that we received arrays
            if (!Array.isArray(fetchedMovies)) {
                console.warn("Fetched movies data is not an array. Using empty array.", fetchedMovies);
                fetchedMovies = []; fetchError = true;
            }
            if (!Array.isArray(fetchedHeroes)) {
                console.warn("Fetched heroes data is not an array. Using empty array.", fetchedHeroes);
                fetchedHeroes = []; fetchError = true;
            }

            if (!fetchError) {
                 console.log("Data fetched successfully from Worker.");
                 allMovies = fetchedMovies; // Store raw fetched data
                 allHeroes = fetchedHeroes; // Store raw fetched data
                 localStorage.setItem(MOVIES_STORAGE_KEY, JSON.stringify(allMovies));
                 localStorage.setItem(HEROES_STORAGE_KEY, JSON.stringify(allHeroes));
            }

        } catch (error) {
            console.error("Could not fetch data from Worker:", error);
            fetchError = true;
        }

        // If fetching failed, try to load from localStorage
        if (fetchError) {
            console.log("Falling back to localStorage data due to fetch error from Worker.");
            allMovies = loadDataFromStorage(MOVIES_STORAGE_KEY, []);
            allHeroes = loadDataFromStorage(HEROES_STORAGE_KEY, []);
        }

        // Final fallback to hardcoded sample data if all else fails or yields no data
        if ((allMovies.length === 0 || allHeroes.length === 0)) {
            const reason = fetchError ? "Worker/localStorage fetch failed" : "No data from Worker or localStorage";
            console.warn(`${reason}. Using hardcoded sample data as last resort.`);
            // Ensure your hardcoded data matches the expected JSON structure
            allHeroes = [
                { "id": "ntr_sr", "name": "N. T. Rama Rao Sr." }, { "id": "anr", "name": "Akkineni Nageswara Rao" },
                { "id": "krishna", "name": "Krishna Ghattamaneni" }, { "id": "chiranjeevi", "name": "Chiranjeevi K." },
                { "id": "mahesh_babu", "name": "Mahesh Babu" }, { "id": "pawan_kalyan", "name": "Pawan Kalyan" }
                // Add more sample heroes if needed
            ];
            allMovies = [
                { "id": "gundamma_1962", "title": "Gundamma Katha", "year": "1962", "thumbnailUrl": "https://via.placeholder.com/320x180/FFD700/000000?Text=Gundamma", "redirectUrl": "#", "heroId": "ntr_sr" },
                { "id": "lava_kusa_1963", "title": "Lava Kusa", "year": "1963", "thumbnailUrl": "https://via.placeholder.com/320x180/FF7F50/FFFFFF?Text=LavaKusa", "redirectUrl": "#", "heroId": "ntr_sr" },
                { "id": "devadasu_1953", "title": "Devadasu", "year": "1953", "thumbnailUrl": "https://via.placeholder.com/320x180/6495ED/FFFFFF?Text=Devadasu", "redirectUrl": "#", "heroId": "anr" },
                { "id": "mayabazar_1957", "title": "Mayabazar", "year": "1957", "thumbnailUrl": "https://via.placeholder.com/320x180/DC143C/FFFFFF?Text=Mayabazar", "redirectUrl": "#", "heroId": "ntr_sr" },
                { "id": "pokiri_2006", "title": "Pokiri", "year": "2006", "thumbnailUrl": "https://via.placeholder.com/320x180/20B2AA/FFFFFF?Text=Pokiri", "redirectUrl": "#", "heroId": "mahesh_babu" }
                // Add more sample movies
            ];
            // Optionally, you might want to save this hardcoded data to localStorage here if you want it to persist for the next session if the fetch fails again.
            // localStorage.setItem(MOVIES_STORAGE_KEY, JSON.stringify(allMovies));
            // localStorage.setItem(HEROES_STORAGE_KEY, JSON.stringify(allHeroes));
        }

        // Process the movie data (whether from fetch, localStorage, or hardcoded)
        // This ensures consistent structure (e.g., year as number, default values)
        processedMovies = processMovieData(allMovies);


        // --- UI Initialization and Initial Load ---
        selectedHeroIdHidden.value = ""; // Reset filters
        selectedHeroNameDisplay.textContent = "All Hero Movies";
        selectedYearHidden.value = "";
        selectedYearNameDisplay.textContent = "Filter by Year";
        yearOptionsSearchInput.value = "";

        // Check if essential data is available before enabling UI and loading movies
        if (processedMovies.length === 0 || allHeroes.length === 0) {
            if (movieGrid) movieGrid.innerHTML = '<p class="no-results">No movies or essential hero data could be loaded. Please check your internet connection or try again later.</p>';
            // Disable controls
            [searchInput, heroSelectTrigger, yearSelectTrigger, sortBySelect, randomMovieBtn].forEach(el => {
                if (el) {
                    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.disabled = true;
                    else el.style.pointerEvents = 'none'; // For div-based triggers
                }
            });
            return; // Stop further initialization
        }

        // Enable controls now that data is present (or seems to be)
        [searchInput, sortBySelect, randomMovieBtn].forEach(el => { if (el) el.disabled = false; });
        if (heroSelectTrigger) heroSelectTrigger.style.pointerEvents = 'auto';
        if (yearSelectTrigger) yearSelectTrigger.style.pointerEvents = 'auto';

        populateAllAvailableYears(processedMovies);
        resetAndLoadMovies(); // Perform the initial display of movies

        // --- Event Listeners Setup ---
        // (These are the same event listeners from your previous full script)
        if (logoLink) {
            logoLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                if (sortBySelect) sortBySelect.value = 'default';
                selectedHeroIdHidden.value = ""; selectedHeroNameDisplay.textContent = "All Hero Movies";
                if (heroOptionsPanel.classList.contains('open')) { populateHeroOptions(allHeroes, '', '');}
                selectedYearHidden.value = ""; selectedYearNameDisplay.textContent = "Filter by Year";
                yearOptionsSearchInput.value = "";
                if (yearOptionsPanel.classList.contains('open')) { populateYearOptions(allAvailableYears, '', '');}
                resetAndLoadMovies();
            });
        }
        if (searchInput) {
            searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(resetAndLoadMovies, SEARCH_DEBOUNCE_MS); });
            searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { clearTimeout(searchTimeout); resetAndLoadMovies(); }});
        }
        if (sortBySelect) { sortBySelect.addEventListener('change', resetAndLoadMovies); }
        if (randomMovieBtn) { randomMovieBtn.addEventListener('click', handleRandomMovie); }

        // Hero Select Listeners
        if (heroSelectTrigger) {
            heroSelectTrigger.addEventListener('click', toggleHeroOptionsPanel);
            heroSelectTrigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHeroOptionsPanel(); } else if (e.key === 'Escape') { closeHeroOptionsPanel(); heroSelectTrigger.focus(); }});
        }
        if (heroOptionsSearchInput) {
            heroOptionsSearchInput.addEventListener('input', () => { clearTimeout(heroSearchTimeout); heroSearchTimeout = setTimeout(() => { populateHeroOptions(allHeroes, heroOptionsSearchInput.value, selectedHeroIdHidden.value); }, HERO_SEARCH_DEBOUNCE_MS); });
            heroOptionsSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.stopPropagation(); closeHeroOptionsPanel(); heroSelectTrigger.focus(); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); const firstValidOption = heroOptionsList.querySelector('li:not(.no-hero-results)'); if (firstValidOption) { heroOptionsList.focus(); currentFocusedHeroOptionIndex = Array.from(heroOptionsList.children).indexOf(firstValidOption); updateFocusedHeroOption(); }}
            });
        }
        if (heroOptionsList) {
            heroOptionsList.addEventListener('keydown', (e) => {
                const options = Array.from(heroOptionsList.children).filter(li => !li.classList.contains('no-hero-results')); if (!options.length) return; let newIndex = currentFocusedHeroOptionIndex;
                if (e.key === 'ArrowDown') { e.preventDefault(); newIndex = (currentFocusedHeroOptionIndex + 1) % options.length; }
                else if (e.key === 'ArrowUp') { e.preventDefault(); newIndex = (currentFocusedHeroOptionIndex - 1 + options.length) % options.length; }
                else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (newIndex >= 0 && newIndex < options.length) { options[newIndex].click(); /*selectHeroOption(options[newIndex]);*/ } return; } // Use click to trigger selectHeroOption
                else if (e.key === 'Escape') { closeHeroOptionsPanel(); heroSelectTrigger.focus(); return; }
                else if (e.key === 'Home') { e.preventDefault(); newIndex = 0; }
                else if (e.key === 'End') { e.preventDefault(); newIndex = options.length - 1; }
                else if (e.key.length === 1 && e.key.match(/[a-z0-9]/i)) { heroOptionsSearchInput.focus(); return; }
                if (newIndex !== currentFocusedHeroOptionIndex) { currentFocusedHeroOptionIndex = newIndex; updateFocusedHeroOption(); }
            });
        }

        // Year Select Listeners
        if (yearSelectTrigger) {
            yearSelectTrigger.addEventListener('click', toggleYearOptionsPanel);
            yearSelectTrigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleYearOptionsPanel(); } else if (e.key === 'Escape') { closeYearOptionsPanel(); yearSelectTrigger.focus(); }});
        }
        if (yearOptionsSearchInput) {
            yearOptionsSearchInput.addEventListener('input', () => {clearTimeout(yearSearchTimeout); yearSearchTimeout = setTimeout(() => {const typedText = yearOptionsSearchInput.value.trim(); populateYearOptions(allAvailableYears, typedText, selectedYearHidden.value); /* Don't auto-select while typing, let user confirm with Enter/Click resetAndLoadMovies(); */ }, YEAR_SEARCH_DEBOUNCE_MS);});
            yearOptionsSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.stopPropagation(); closeYearOptionsPanel(); yearSelectTrigger.focus(); }
                else if (e.key === 'Enter') { // If user presses Enter in search, try to select best match or apply filter
                    e.preventDefault();
                    const options = Array.from(yearOptionsList.children).filter(li => !li.classList.contains('no-year-results'));
                    if (currentFocusedYearOptionIndex >= 0 && currentFocusedYearOptionIndex < options.length) {
                        options[currentFocusedYearOptionIndex].click(); // selectYearOption(options[currentFocusedYearOptionIndex]);
                    } else if (options.length > 0) { // Select first available option if none focused
                         options[0].click(); // selectYearOption(options[0]);
                    } else { // No options, maybe apply typed text if it's a valid year pattern
                        const typedYear = yearOptionsSearchInput.value.trim();
                        if (typedYear === "" || /^\d{1,4}$/.test(typedYear)) { // Allow empty or up to 4 digits
                            selectedYearHidden.value = typedYear;
                            selectedYearNameDisplay.textContent = typedYear === "" ? "Filter by Year" : typedYear;
                            closeYearOptionsPanel();
                            resetAndLoadMovies();
                        }
                    }
                }
                else if (e.key === 'ArrowDown') { e.preventDefault(); const firstValidOption = yearOptionsList.querySelector('li:not(.no-year-results)'); if (firstValidOption) { yearOptionsList.focus(); if (currentFocusedYearOptionIndex < 0 || !yearOptionsList.children[currentFocusedYearOptionIndex] || yearOptionsList.children[currentFocusedYearOptionIndex].classList.contains('no-year-results')) { currentFocusedYearOptionIndex = Array.from(yearOptionsList.children).indexOf(firstValidOption); }  updateFocusedYearOption(); }}
            });
        }
        if (yearOptionsList) {
            yearOptionsList.addEventListener('keydown', (e) => {
                const options = Array.from(yearOptionsList.children).filter(li => !li.classList.contains('no-year-results')); if (!options.length) return; let newIndex = currentFocusedYearOptionIndex;
                if (e.key === 'ArrowDown') { e.preventDefault(); newIndex = (currentFocusedYearOptionIndex + 1) % options.length; }
                else if (e.key === 'ArrowUp') { e.preventDefault(); newIndex = (currentFocusedYearOptionIndex - 1 + options.length) % options.length; }
                else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (newIndex >= 0 && newIndex < options.length) { options[newIndex].click(); /*selectYearOption(options[newIndex]);*/ } return; }
                else if (e.key === 'Escape') { closeYearOptionsPanel(); yearSelectTrigger.focus(); return; }
                else if (e.key === 'Home') { e.preventDefault(); newIndex = 0; }
                else if (e.key === 'End') { e.preventDefault(); newIndex = options.length - 1; }
                else if (e.key.length === 1 && e.key.match(/[a-z0-9]/i)) { yearOptionsSearchInput.focus(); return; }
                if (newIndex !== currentFocusedYearOptionIndex) { currentFocusedYearOptionIndex = newIndex; updateFocusedYearOption(); }
            });
        }

        // Global click listener to close dropdowns
        document.addEventListener('click', (event) => {
            if (customHeroSelectWrapper && !customHeroSelectWrapper.contains(event.target)) {
                closeHeroOptionsPanel();
            }
            if (customYearSelectWrapper && !customYearSelectWrapper.contains(event.target)) {
                closeYearOptionsPanel();
            }
        });

        // Scroll listener for infinite loading
        window.addEventListener('scroll', throttledScrollHandler, { passive: true });

    } // End of initializeApp

    initializeApp();
});
