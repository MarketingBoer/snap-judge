import { Devvit, useState, useWebView } from '@devvit/public-api';

Devvit.configure({ redditAPI: true, redis: true });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LB_KEYS: Record<string, string> = {
  sp: 'lb:sp:v1',
  qd: 'lb:qd:v1',
  mw: 'lb:mw:v1',
};

const MODE_CEILINGS: Record<string, number> = {
  sp: 50_000,
  qd: 100_000,
  mw: 150_000,
};

const MODES = ['street_patrol', 'quick_draw', 'most_wanted'] as const;
const MODE_SHORT: Record<string, string> = {
  street_patrol: 'sp',
  quick_draw: 'qd',
  most_wanted: 'mw',
};

const LIMIT = 25;

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function clampScore(n: unknown, mode: string): number | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  if (x < 0) return null;
  const ceiling = MODE_CEILINGS[mode] ?? 150_000;
  if (x > ceiling) return null;
  return Math.floor(x);
}

function getDailyDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDailySeed(): number {
  const dateStr = getDailyDateString();
  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) + hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getDailyMode(): string {
  const hash = getDailySeed();
  return MODES[hash % 3];
}

function getWeekKey(mode: string): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `lb:${mode}:weekly:${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getDailyKey(): string {
  return `lb:daily:${getDailyDateString()}`;
}

async function readTop(
  context: Devvit.Context,
  key: string,
  limit: number = LIMIT,
): Promise<Array<{ rank: number; username: string; score: number }>> {
  const n = await context.redis.zCard(key);
  if (!n || n <= 0) return [];
  const start = Math.max(0, n - limit);
  const items = await context.redis.zRange(key, start, n - 1, { by: 'rank' });
  const desc = [...items].reverse();
  return desc.map((it: { member: string; score: number }, i: number) => ({
    rank: i + 1,
    username: String(it.member),
    score: Number(it.score),
  }));
}

async function getPlayerRank(
  context: Devvit.Context,
  key: string,
  username: string,
): Promise<number | null> {
  try {
    const card = await context.redis.zCard(key);
    if (!card || card <= 0) return null;
    const rank = await context.redis.zRank(key, username);
    if (rank == null) return null;
    // zRank is ascending (0-indexed), convert to descending 1-based
    return card - rank;
  } catch {
    return null;
  }
}

async function upsertBestScore(
  context: Devvit.Context,
  username: string,
  score: number,
  modeKey: string,
  weekKey: string,
): Promise<{ saved: boolean; isNewHighScore: boolean; previousBest: number | null }> {
  const prev = await context.redis.zScore(modeKey, username);
  const prevNum = prev == null ? null : Number(prev);
  const saved = prevNum === null || score > prevNum;
  const isNewHighScore = prevNum !== null && score > prevNum;

  if (saved) {
    await Promise.all([
      context.redis.zAdd(modeKey, { member: username, score }),
      context.redis.zAdd(weekKey, { member: username, score }),
    ]);
  } else {
    // Even if all-time not beaten, weekly might be new/higher
    const weekPrev = await context.redis.zScore(weekKey, username);
    if (weekPrev == null || score > Number(weekPrev)) {
      await context.redis.zAdd(weekKey, { member: username, score });
    }
  }
  await context.redis.expire(weekKey, 691200);
  return { saved, isNewHighScore, previousBest: prevNum };
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Custom Post Type
// ---------------------------------------------------------------------------

Devvit.addCustomPostType({
  name: 'Snap Judge',
  height: 'tall',

  render: (context) => {
    const [_top, _setTop] = useState<Array<{ rank: number; username: string; score: number }>>([]);

    const { mount } = useWebView({
      url: 'page.html',
      onMessage: async (msg, webView) => {
        const message = msg as { type?: string; data?: Record<string, unknown> };
        if (!message || typeof message.type !== 'string') return;

        // ---------------------------------------------------------------
        // webViewReady - send initial data
        // ---------------------------------------------------------------
        if (message.type === 'webViewReady') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const spKey = LB_KEYS.sp;
          const weekKeySp = getWeekKey('sp');
          const dailyKey = getDailyKey();
          const statsKey = username ? `stats:${username}` : null;

          const [
            leaderboard,
            weeklyBoard,
            playerRankAlltime,
            playerRankWeekly,
            statsHash,
          ] = await Promise.all([
            readTop(context, spKey),
            readTop(context, weekKeySp),
            username ? getPlayerRank(context, spKey, username) : Promise.resolve(null),
            username ? getPlayerRank(context, weekKeySp, username) : Promise.resolve(null),
            statsKey ? context.redis.hGetAll(statsKey) : Promise.resolve({}),
          ]);

          let dailyBest: number | null = null;
          if (username) {
            try {
              const ds = await context.redis.zScore(dailyKey, username);
              if (ds != null) dailyBest = Number(ds);
            } catch { /* no daily score yet */ }
          }

          webView.postMessage({
            type: 'initialData',
            data: {
              username,
              leaderboard,
              weeklyBoard,
              playerRankAlltime,
              playerRankWeekly,
              stats: statsHash || {},
              dailySeed: getDailySeed(),
              dailyDate: getDailyDateString(),
              dailyMode: getDailyMode(),
              dailyBest,
            },
          });
          return;
        }

        // ---------------------------------------------------------------
        // getLeaderboard - lazy load a specific mode's boards
        // ---------------------------------------------------------------
        if (message.type === 'getLeaderboard') {
          const mode = String(message?.data?.mode || 'sp');
          if (!LB_KEYS[mode]) return;

          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const modeKey = LB_KEYS[mode];
          const weekKey = getWeekKey(mode);

          const [leaderboard, weeklyBoard, playerRankAlltime, playerRankWeekly] =
            await Promise.all([
              readTop(context, modeKey),
              readTop(context, weekKey),
              username ? getPlayerRank(context, modeKey, username) : Promise.resolve(null),
              username ? getPlayerRank(context, weekKey, username) : Promise.resolve(null),
            ]);

          webView.postMessage({
            type: 'modeLeaderboard',
            data: {
              mode,
              leaderboard,
              weeklyBoard,
              playerRankAlltime,
              playerRankWeekly,
            },
          });
          return;
        }

        // ---------------------------------------------------------------
        // GAME_OVER_SP - Street Patrol game over
        // ---------------------------------------------------------------
        if (message.type === 'GAME_OVER_SP') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const d = (message?.data || {}) as Record<string, unknown>;
          const score = clampScore(d.score, 'sp');

          if (score === null) {
            webView.postMessage({ type: 'error', data: { message: 'Invalid score payload' } });
            return;
          }

          if (!username) {
            const [leaderboard, weeklyBoard] = await Promise.all([
              readTop(context, LB_KEYS.sp),
              readTop(context, getWeekKey('sp')),
            ]);
            webView.postMessage({
              type: 'leaderboard',
              data: {
                mode: 'sp',
                leaderboard,
                weeklyBoard,
                saved: false,
                score,
                isNewHighScore: false,
                previousBest: null,
                playerRankAlltime: null,
                playerRankWeekly: null,
                username: null,
              },
            });
            return;
          }

          const level = Math.floor(Math.max(1, Number(d.level) || 1));
          const criminals = Math.floor(Math.max(0, Number(d.criminals) || 0));
          const modeKey = LB_KEYS.sp;
          const weekKey = getWeekKey('sp');
          const statsKey = `stats:${username}`;

          const { saved, isNewHighScore, previousBest } = await upsertBestScore(
            context, username, score, modeKey, weekKey,
          );

          // Update stats hash
          const currentStats = await context.redis.hGetAll(statsKey);
          const prevBestScore = Number(currentStats.sp_bestScore || '0');
          const prevBestLevel = Number(currentStats.sp_bestLevel || '0');
          const prevTotalCriminals = Number(currentStats.sp_totalCriminals || '0');
          const prevTotalGames = Number(currentStats.totalGames || '0');

          const statsUpdate: Record<string, string> = {
            totalGames: String(prevTotalGames + 1),
            sp_totalCriminals: String(prevTotalCriminals + criminals),
          };
          if (score > prevBestScore) statsUpdate.sp_bestScore = String(score);
          if (level > prevBestLevel) statsUpdate.sp_bestLevel = String(level);

          const [leaderboard, weeklyBoard, playerRankAlltime, playerRankWeekly] =
            await Promise.all([
              readTop(context, modeKey),
              readTop(context, weekKey),
              getPlayerRank(context, modeKey, username),
              getPlayerRank(context, weekKey, username),
              context.redis.hSet(statsKey, statsUpdate),
              context.redis.incrBy('community:totalCriminals', criminals),
              context.redis.incrBy('community:totalGames', 1),
            ]);

          webView.postMessage({
            type: 'leaderboard',
            data: {
              mode: 'sp',
              leaderboard,
              weeklyBoard,
              saved,
              score,
              isNewHighScore,
              previousBest,
              playerRankAlltime,
              playerRankWeekly,
              username,
            },
          });
          if (saved) context.ui.showToast(`Score saved: ${formatNumber(score)}`);
          return;
        }

        // ---------------------------------------------------------------
        // GAME_OVER_QD - Quick Draw game over
        // ---------------------------------------------------------------
        if (message.type === 'GAME_OVER_QD') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const d = (message?.data || {}) as Record<string, unknown>;
          const score = clampScore(d.score, 'qd');

          if (score === null) {
            webView.postMessage({ type: 'error', data: { message: 'Invalid score payload' } });
            return;
          }

          if (!username) {
            const [leaderboard, weeklyBoard] = await Promise.all([
              readTop(context, LB_KEYS.qd),
              readTop(context, getWeekKey('qd')),
            ]);
            webView.postMessage({
              type: 'leaderboard',
              data: {
                mode: 'qd',
                leaderboard,
                weeklyBoard,
                saved: false,
                score,
                isNewHighScore: false,
                previousBest: null,
                playerRankAlltime: null,
                playerRankWeekly: null,
                username: null,
              },
            });
            return;
          }

          const round = Math.floor(Math.max(1, Number(d.round) || 1));
          const modeKey = LB_KEYS.qd;
          const weekKey = getWeekKey('qd');
          const statsKey = `stats:${username}`;

          const { saved, isNewHighScore, previousBest } = await upsertBestScore(
            context, username, score, modeKey, weekKey,
          );

          // Update stats hash
          const currentStats = await context.redis.hGetAll(statsKey);
          const prevBestScore = Number(currentStats.qd_bestScore || '0');
          const prevBestRound = Number(currentStats.qd_bestRound || '0');
          const prevTotalGames = Number(currentStats.totalGames || '0');

          const statsUpdate: Record<string, string> = {
            totalGames: String(prevTotalGames + 1),
          };
          if (score > prevBestScore) statsUpdate.qd_bestScore = String(score);
          if (round > prevBestRound) statsUpdate.qd_bestRound = String(round);

          const [leaderboard, weeklyBoard, playerRankAlltime, playerRankWeekly] =
            await Promise.all([
              readTop(context, modeKey),
              readTop(context, weekKey),
              getPlayerRank(context, modeKey, username),
              getPlayerRank(context, weekKey, username),
              context.redis.hSet(statsKey, statsUpdate),
              context.redis.incrBy('community:totalGames', 1),
            ]);

          webView.postMessage({
            type: 'leaderboard',
            data: {
              mode: 'qd',
              leaderboard,
              weeklyBoard,
              saved,
              score,
              isNewHighScore,
              previousBest,
              playerRankAlltime,
              playerRankWeekly,
              username,
            },
          });
          if (saved) context.ui.showToast(`Score saved: ${formatNumber(score)}`);
          return;
        }

        // ---------------------------------------------------------------
        // GAME_OVER_MW - Most Wanted game over
        // ---------------------------------------------------------------
        if (message.type === 'GAME_OVER_MW') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const d = (message?.data || {}) as Record<string, unknown>;
          const score = clampScore(d.score, 'mw');

          if (score === null) {
            webView.postMessage({ type: 'error', data: { message: 'Invalid score payload' } });
            return;
          }

          if (!username) {
            const [leaderboard, weeklyBoard] = await Promise.all([
              readTop(context, LB_KEYS.mw),
              readTop(context, getWeekKey('mw')),
            ]);
            webView.postMessage({
              type: 'leaderboard',
              data: {
                mode: 'mw',
                leaderboard,
                weeklyBoard,
                saved: false,
                score,
                isNewHighScore: false,
                previousBest: null,
                playerRankAlltime: null,
                playerRankWeekly: null,
                username: null,
              },
            });
            return;
          }

          const round = Math.floor(Math.max(1, Number(d.round) || 1));
          const modeKey = LB_KEYS.mw;
          const weekKey = getWeekKey('mw');
          const statsKey = `stats:${username}`;

          const { saved, isNewHighScore, previousBest } = await upsertBestScore(
            context, username, score, modeKey, weekKey,
          );

          // Update stats hash
          const currentStats = await context.redis.hGetAll(statsKey);
          const prevBestScore = Number(currentStats.mw_bestScore || '0');
          const prevBestRound = Number(currentStats.mw_bestRound || '0');
          const prevTotalGames = Number(currentStats.totalGames || '0');

          const statsUpdate: Record<string, string> = {
            totalGames: String(prevTotalGames + 1),
          };
          if (score > prevBestScore) statsUpdate.mw_bestScore = String(score);
          if (round > prevBestRound) statsUpdate.mw_bestRound = String(round);

          const [leaderboard, weeklyBoard, playerRankAlltime, playerRankWeekly] =
            await Promise.all([
              readTop(context, modeKey),
              readTop(context, weekKey),
              getPlayerRank(context, modeKey, username),
              getPlayerRank(context, weekKey, username),
              context.redis.hSet(statsKey, statsUpdate),
              context.redis.incrBy('community:totalGames', 1),
            ]);

          webView.postMessage({
            type: 'leaderboard',
            data: {
              mode: 'mw',
              leaderboard,
              weeklyBoard,
              saved,
              score,
              isNewHighScore,
              previousBest,
              playerRankAlltime,
              playerRankWeekly,
              username,
            },
          });
          if (saved) context.ui.showToast(`Score saved: ${formatNumber(score)}`);
          return;
        }

        // ---------------------------------------------------------------
        // DAILY_GAME_OVER - Daily challenge game over
        // ---------------------------------------------------------------
        if (message.type === 'DAILY_GAME_OVER') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          const d = (message?.data || {}) as Record<string, unknown>;
          const dailyModeRaw = String(d.mode || getDailyMode());
          const modeShort = MODE_SHORT[dailyModeRaw] || 'sp';
          const score = clampScore(d.score, modeShort);

          if (score === null) {
            webView.postMessage({ type: 'error', data: { message: 'Invalid daily score' } });
            return;
          }

          const dailyKey = getDailyKey();

          if (!username) {
            const dailyBoard = await readTop(context, dailyKey);
            webView.postMessage({
              type: 'dailyLeaderboard',
              data: {
                dailyBoard,
                dailySaved: false,
                score,
                username: null,
                dailyDate: getDailyDateString(),
                playerRankDaily: null,
              },
            });
            return;
          }

          // Upsert daily best
          let dailySaved = false;
          try {
            const dailyPrev = await context.redis.zScore(dailyKey, username);
            dailySaved = dailyPrev == null || score > Number(dailyPrev);
          } catch { dailySaved = true; }
          if (dailySaved) {
            await context.redis.zAdd(dailyKey, { member: username, score });
          }
          await context.redis.expire(dailyKey, 172800);

          // Also update mode-specific all-time + weekly
          const modeKey = LB_KEYS[modeShort];
          const weekKey = getWeekKey(modeShort);
          const statsKey = `stats:${username}`;

          const { saved, isNewHighScore, previousBest } = await upsertBestScore(
            context, username, score, modeKey, weekKey,
          );

          // Update mode stats based on which mode
          const currentStats = await context.redis.hGetAll(statsKey);
          const prevTotalGames = Number(currentStats.totalGames || '0');
          const statsUpdate: Record<string, string> = {
            totalGames: String(prevTotalGames + 1),
          };

          if (modeShort === 'sp') {
            const level = Math.floor(Math.max(1, Number(d.level) || 1));
            const criminals = Math.floor(Math.max(0, Number(d.criminals) || 0));
            const prevBestScore = Number(currentStats.sp_bestScore || '0');
            const prevBestLevel = Number(currentStats.sp_bestLevel || '0');
            const prevTotalCriminals = Number(currentStats.sp_totalCriminals || '0');
            if (score > prevBestScore) statsUpdate.sp_bestScore = String(score);
            if (level > prevBestLevel) statsUpdate.sp_bestLevel = String(level);
            statsUpdate.sp_totalCriminals = String(prevTotalCriminals + criminals);
          } else if (modeShort === 'qd') {
            const round = Math.floor(Math.max(1, Number(d.round) || 1));
            const prevBestScore = Number(currentStats.qd_bestScore || '0');
            const prevBestRound = Number(currentStats.qd_bestRound || '0');
            if (score > prevBestScore) statsUpdate.qd_bestScore = String(score);
            if (round > prevBestRound) statsUpdate.qd_bestRound = String(round);
          } else if (modeShort === 'mw') {
            const round = Math.floor(Math.max(1, Number(d.round) || 1));
            const prevBestScore = Number(currentStats.mw_bestScore || '0');
            const prevBestRound = Number(currentStats.mw_bestRound || '0');
            if (score > prevBestScore) statsUpdate.mw_bestScore = String(score);
            if (round > prevBestRound) statsUpdate.mw_bestRound = String(round);
          }

          const [
            leaderboard,
            weeklyBoard,
            dailyBoard,
            playerRankAlltime,
            playerRankWeekly,
            playerRankDaily,
          ] = await Promise.all([
            readTop(context, modeKey),
            readTop(context, weekKey),
            readTop(context, dailyKey),
            getPlayerRank(context, modeKey, username),
            getPlayerRank(context, weekKey, username),
            getPlayerRank(context, dailyKey, username),
            context.redis.hSet(statsKey, statsUpdate),
            context.redis.incrBy('community:totalGames', 1),
          ]);

          webView.postMessage({
            type: 'dailyLeaderboard',
            data: {
              mode: modeShort,
              leaderboard,
              weeklyBoard,
              dailyBoard,
              dailySaved,
              saved,
              score,
              isNewHighScore,
              previousBest,
              playerRankAlltime,
              playerRankWeekly,
              playerRankDaily,
              username,
              dailyDate: getDailyDateString(),
            },
          });
          if (dailySaved) context.ui.showToast(`Daily score: ${formatNumber(score)}`);
          return;
        }

        // ---------------------------------------------------------------
        // SHARE_SCORE - Post score as Reddit comment
        // ---------------------------------------------------------------
        if (message.type === 'SHARE_SCORE') {
          const username = (await context.reddit.getCurrentUsername()) ?? null;
          if (!username) {
            webView.postMessage({ type: 'shareResult', data: { success: false } });
            return;
          }

          const d = (message?.data || {}) as Record<string, unknown>;
          const mode = String(d.mode || 'sp');
          const score = clampScore(d.score, mode);
          if (score === null) {
            webView.postMessage({ type: 'shareResult', data: { success: false } });
            return;
          }

          // Rate limit: 60s per user per post
          const rateLimitKey = `share:${context.postId}:${username}:last`;
          try {
            const lastShare = await context.redis.get(rateLimitKey);
            if (lastShare && Date.now() - Number(lastShare) < 60000) {
              webView.postMessage({ type: 'shareResult', data: { success: false } });
              return;
            }
          } catch { /* proceed */ }

          const stats = (d.stats || {}) as Record<string, unknown>;
          let lines: string[] = [];

          if (mode === 'sp') {
            const level = Math.floor(Math.max(1, Number(stats.level) || 1));
            const criminals = Math.floor(Math.max(0, Number(stats.criminals) || 0));
            const headshots = Math.floor(Math.max(0, Number(stats.headshots) || 0));
            const accuracy = Math.floor(Math.max(0, Math.min(100, Number(stats.accuracy) || 0)));
            const bestCombo = Math.floor(Math.max(0, Number(stats.bestCombo) || 0));

            lines = [
              `**OFFICER** | Street Patrol`,
              ``,
              `| Stat | Value |`,
              `|:--|:--|`,
              `| Score | **${formatNumber(score)}** |`,
              `| Level | ${level}/5 |`,
              `| Criminals Caught | ${criminals} |`,
              `| Headshots | ${headshots} |`,
              `| Accuracy | ${accuracy}% |`,
              `| Best Combo | x${bestCombo} |`,
              ``,
              `*Played by u/${username} in Snap Judge*`,
            ];
          } else if (mode === 'qd') {
            const round = Math.floor(Math.max(1, Number(stats.round) || 1));
            const correctShots = Math.floor(Math.max(0, Number(stats.correctShots) || 0));
            const bestStreak = Math.floor(Math.max(0, Number(stats.bestStreak) || 0));

            lines = [
              `**MARKSMAN** | Quick Draw`,
              ``,
              `| Stat | Value |`,
              `|:--|:--|`,
              `| Score | **${formatNumber(score)}** |`,
              `| Round | ${round} |`,
              `| Correct Shots | ${correctShots} |`,
              `| Best Streak | ${bestStreak} |`,
              ``,
              `*Played by u/${username} in Snap Judge*`,
            ];
          } else if (mode === 'mw') {
            const round = Math.floor(Math.max(1, Number(stats.round) || 1));
            const correctIDs = Math.floor(Math.max(0, Number(stats.correctIDs) || 0));
            const accuracy = Math.floor(Math.max(0, Math.min(100, Number(stats.accuracy) || 0)));

            lines = [
              `**DETECTIVE** | Most Wanted`,
              ``,
              `| Stat | Value |`,
              `|:--|:--|`,
              `| Score | **${formatNumber(score)}** |`,
              `| Round | ${round} |`,
              `| Correct IDs | ${correctIDs} |`,
              `| Accuracy | ${accuracy}% |`,
              ``,
              `*Played by u/${username} in Snap Judge*`,
            ];
          }

          if (lines.length === 0) {
            webView.postMessage({ type: 'shareResult', data: { success: false } });
            return;
          }

          try {
            await context.reddit.submitComment({
              id: context.postId!,
              text: lines.join('\n'),
            });
            await context.redis.set(rateLimitKey, String(Date.now()));
            await context.redis.expire(rateLimitKey, 120);
            webView.postMessage({ type: 'shareResult', data: { success: true } });
          } catch {
            webView.postMessage({ type: 'shareResult', data: { success: false } });
          }
          return;
        }
      },
    });

    // -------------------------------------------------------------------
    // Blocks UI - Preview (shown before WebView mounts)
    // -------------------------------------------------------------------
    return Devvit.createElement(
      'vstack',
      {
        alignment: 'center middle',
        gap: 'medium',
        padding: 'large',
        backgroundColor: '#1a1a2e',
        width: '100%',
        height: '100%',
      },
      Devvit.createElement('spacer', { size: 'large' }),
      Devvit.createElement(
        'text',
        { size: 'xxlarge', weight: 'bold', color: '#e94560' },
        'SNAP JUDGE',
      ),
      Devvit.createElement('spacer', { size: 'small' }),
      Devvit.createElement(
        'text',
        { size: 'medium', color: '#ffffff' },
        'Shoot criminals. Spare civilians.',
      ),
      Devvit.createElement('spacer', { size: 'medium' }),
      Devvit.createElement(
        'button',
        { appearance: 'primary', onPress: mount },
        'PLAY',
      ),
      Devvit.createElement('spacer', { size: 'large' }),
    );
  },
});

// ---------------------------------------------------------------------------
// Menu Item - Create post
// ---------------------------------------------------------------------------

Devvit.addMenuItem({
  label: 'Add Snap Judge Post',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const subredditName = await context.reddit.getCurrentSubredditName();
    await context.reddit.submitPost({
      title: 'Snap Judge - Shoot or Spare?',
      subredditName,
      preview: Devvit.createElement(
        'vstack',
        { alignment: 'center middle', padding: 'large' },
        Devvit.createElement('text', { size: 'xlarge', weight: 'bold' }, 'Snap Judge'),
        Devvit.createElement('text', {}, 'Loading...'),
      ),
    });
    context.ui.showToast(`Snap Judge post created in r/${subredditName}`);
  },
});

// ---------------------------------------------------------------------------
// Compliance Triggers
// ---------------------------------------------------------------------------

// AccountDelete: proto exists in @devvit/protos but is not in the SDK's
// TriggerEventType map for v0.12.x. We use @ts-ignore so the runtime
// can still register the handler (Devvit's bundler passes it through).
// @ts-ignore — AccountDelete is a valid runtime trigger event
Devvit.addTrigger({
  // @ts-ignore — AccountDelete not in TriggerEventType but supported at runtime
  event: 'AccountDelete' as const,
  onEvent: async (event: any, context: any) => {
    const username: string | undefined = event?.user?.username ?? event?.targetUser?.name;
    if (!username) return;
    await Promise.all([
      context.redis.del(`stats:${username}`),
      context.redis.zRem('lb:sp:v1', [username]),
      context.redis.zRem('lb:qd:v1', [username]),
      context.redis.zRem('lb:mw:v1', [username]),
    ]);
  },
});

Devvit.addTrigger({
  event: 'PostDelete',
  onEvent: async (_event, _context) => {
    // share:{postId}:{user}:last keys have 120s TTL, self-expire
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default Devvit;
