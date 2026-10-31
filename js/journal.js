// Journal page: blog posts with comments, the milestone timeline and tournaments, one tab at a time.
// Relies on globals from config.js, helpers from data.js (parseCSV, processRoundsData,
// processScorecardData), render.js (renderTimeline, renderTournaments, cloudinaryAuto) and
// scorecard-modal.js. Each tab loads on its own, so one missing sheet can't blank the others.

const BLOG_SHEET = 'Blog';

const COMMENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEbgE8yZmqzR_zl8f4EwWaf_oLUYYVwSOcW1GXLqodpSWM-c7H8AmzDkykKXnPQUHk4afeNK1K2ixv/pub?gid=1057741360&single=true&output=csv';
const COMMENT_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScDWk_zOf3UmQqEhPHNJJSHp5DETGfFJXr8GL1y7YDxZrgF2g/viewform?usp=pp_url&entry.856642048=';

// ---- Comments ----

// All comments keyed by post_id
let commentsData = {};

function processComments(rawData) {
    const lookup = {};
    rawData.forEach(row => {
        const postId = (row.post_id || '').trim();
        if (!postId) return;
        if (!lookup[postId]) lookup[postId] = [];
        lookup[postId].push({
            name: row.name || 'Anonymous',
            comment: row.comment || '',
            timestamp: row.timestamp || '',
        });
    });
    // Sort comments oldest-first within each post
    Object.values(lookup).forEach(comments => {
        comments.sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
            return 0;
        });
    });
    return lookup;
}

function formatCommentDate(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date)) return timestamp;
    return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

function renderComments(postId) {
    const comments = commentsData[postId] || [];

    let html = '<div class="comments-section">';
    html += '<h4 class="comments-heading">Comments</h4>';

    if (comments.length === 0) {
        html += '<p class="no-comments">No comments yet — be the first!</p>';
    } else {
        html += comments.map(c => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-name">${escapeHtml(c.name)}</span>
                    <span class="comment-date">${formatCommentDate(c.timestamp)}</span>
                </div>
                <p class="comment-text">${escapeHtml(c.comment)}</p>
            </div>
        `).join('');
    }

    // "Leave a comment" button — opens Google Form with pre-filled post_id
    const formUrl = COMMENT_FORM_BASE_URL + encodeURIComponent(postId);
    html += `<a href="${formUrl}" target="_blank" class="leave-comment-btn">Leave a comment</a>`;

    html += '</div>';
    return html;
}

// ---- Blog posts ----

function renderBlogPosts(blogData) {
    const container = document.getElementById('blog-posts');

    if (!blogData || blogData.length === 0) {
        container.innerHTML = '<p class="loading">No blog posts yet</p>';
        return;
    }

    // Sort newest first
    blogData.sort((a, b) => {
        const dateA = new Date(a.date || '');
        const dateB = new Date(b.date || '');
        if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
        return 0;
    });

    container.innerHTML = blogData.map(post => {
        const title = post.title || 'Untitled';
        const date = post.date || '';
        const rawContent = post.content || '';
        const postId = post.post_id || post.title || '';
        const coverUrl = (post.image_url || '').trim();

        // Optional cover image — rendered above the content when image_url is set
        const coverHtml = coverUrl
            ? `<img class="post-cover" src="${escapeHtml(cloudinaryAuto(coverUrl))}" alt="${escapeHtml(title)}" loading="lazy">`
            : '';

        // Convert markdown to HTML
        let htmlContent = '';
        try {
            htmlContent = marked.parse(rawContent);
        } catch (e) {
            htmlContent = '<p>' + rawContent + '</p>';
        }
        // Auto-optimize any inline Cloudinary images in the post body
        htmlContent = cloudinaryAuto(htmlContent);

        return `
            <article class="blog-post" id="post-${encodeURIComponent(postId)}">
                <p class="post-date">${date}</p>
                <h3 class="post-title">${title}</h3>
                ${coverHtml}
                <div class="post-content">${htmlContent}</div>
                ${renderComments(postId)}
            </article>
        `;
    }).join('');
}

// ---- Loading ----

async function loadBlog() {
    const container = document.getElementById('blog-posts');
    try {
        // Fetch blog posts (required) and comments (optional — may not exist yet)
        const [blogResponse, commentsResponse] = await Promise.all([
            fetch(getSheetUrl(BLOG_SHEET)).catch(() => null),
            fetch(COMMENTS_CSV_URL).catch(() => null),
        ]);

        // Parse comments first so they're available when rendering posts
        if (commentsResponse && commentsResponse.ok) {
            commentsData = processComments(parseCSV(await commentsResponse.text()));
        }

        if (blogResponse && blogResponse.ok) {
            renderBlogPosts(parseCSV(await blogResponse.text()));
        } else {
            container.innerHTML = '<p class="loading">Add a "Blog" sheet to your spreadsheet to start posting.</p>';
        }
    } catch (error) {
        console.error('Error loading blog:', error);
        container.innerHTML = '<p class="loading">Error loading blog posts. Check console for details.</p>';
    }
}

async function loadTimeline() {
    const container = document.getElementById('timeline-entries');
    try {
        const response = await fetch(getSheetUrl(MILESTONES_SHEET));
        if (!response.ok) throw new Error(`Milestones sheet returned ${response.status}`);
        renderTimeline(parseCSV(await response.text()));
    } catch (error) {
        console.error('Error loading timeline:', error);
        container.innerHTML = '<p class="loading">Add a "Milestones" sheet to your spreadsheet to start your timeline.</p>';
    }
}

async function loadTournaments() {
    try {
        const [roundsResponse, scorecardsResponse] = await Promise.all([
            fetch(getSheetUrl(ROUNDS_SHEET)),
            fetch(getSheetUrl(SCORECARDS_SHEET)).catch(() => null),
        ]);
        processRoundsData(parseCSV(await roundsResponse.text()));   // populates allRoundsData
        if (scorecardsResponse && scorecardsResponse.ok) {
            scorecardData = processScorecardData(parseCSV(await scorecardsResponse.text()));
        }
        renderTournaments();
        document.getElementById('journal-recaps').innerHTML = allSeasons().map(season =>
            `<a class="journal-recap-link" href="recap.html?season=${season}">${season} season recap →</a>`).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
        document.getElementById('tournament-list').innerHTML = '<p class="loading">Error loading tournaments. Check console for details.</p>';
    }
}

// ---- Tabs ----

function showJournalTab(tab) {
    document.querySelectorAll('[data-journal-tab]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.journalTab === tab));
    document.querySelectorAll('[data-journal-panel]').forEach(panel => {
        panel.hidden = panel.dataset.journalPanel !== tab;
    });
}

function setJournalTab(tab) {
    showJournalTab(tab);
    history.replaceState(null, '', `#${tab}`);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeScorecard();
});

document.addEventListener('DOMContentLoaded', () => {
    const fromHash = location.hash.slice(1);
    showJournalTab(document.querySelector(`[data-journal-tab="${CSS.escape(fromHash)}"]`) ? fromHash : 'blog');
    loadBlog();
    loadTimeline();
    loadTournaments();
});
