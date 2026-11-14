window.__ModuleLoader__.load({
  id: '@isdou/dsh-journal',
  factory(require) {
    const React = require('react');
    const { useState, useEffect, useRef } = React;
    const h = React.createElement;
    const NS = 'dshJournal';
    const PANEL_ID = 'dsh-journal';
    const dictionaries = {
      zh: {
        panel: 'DSH 日记', subtitle: '从对话与改动中，整理这段时间的工作。',
        day: '日报', week: '周报', month: '月报', custom: '自定范围',
        start: '开始日期', end: '结束日期', timeZone: '时区',
        timeZoneHint: '按所选时区计算日期，包含开始和结束当天。',
        scan: '扫描记录', scanning: '正在扫描…', generate: '生成报告', generating: '正在生成…',
        generatingHint: '正在整理这段时间的工作。记录较多时，会先归纳再汇总。',
        cancel: '取消', cancelled: '已取消请求。', loading: '正在加载…', retry: '重试',
        mode: '整理方式', ai: 'AI 工作报告', local: '本地记录整理',
        aiHint: '点击生成后，将此范围的记录发送给简报模型：{model}。',
        aiUnavailable: '简报模型暂不可用。可先生成本地记录整理，或检查 DSH 模型设置。',
        localHint: '直接在本机按会话整理原始记录与改动，不调用模型。',
        sessions: '会话', messages: '消息', tools: '工具调用', changes: '文件操作', failures: '失败调用',
        coverage: '记录范围说明', coverageIncomplete: '部分记录未能读取，这份报告可能不完整。', sourceSessions: '来源会话', noSessions: '这段时间没有找到可整理的记录。',
        sourceHint: '只包含所选日期内记录的活动；会话标题和工作目录用于核对来源。',
        untitled: '未命名会话', noWorkspace: '未记录工作目录', sessionId: '会话 ID',
        report: '工作报告', read: '阅读', edit: '编辑 Markdown', save: '保存修改', saving: '正在保存…',
        unsaved: '有未保存的修改', saved: '修改已保存。', markdown: '报告 Markdown',
        copy: '复制', copied: '已复制。', copyFailed: '无法访问剪贴板，请在编辑模式选中文本复制，或下载 Markdown。',
        download: '下载 Markdown', history: '历史报告', historyEmpty: '生成的报告会保存在这里。',
        emptyTitle: '选择时间范围，生成一份工作报告',
        emptyDescription: '可以先扫描记录核对来源，再选择 AI 总结或本地整理。',
        initialError: '无法加载日记数据。', requestError: '请求未完成，请重试。',
        invalidDate: '请选择有效的开始和结束日期。', invalidOrder: '结束日期不能早于开始日期。',
        invalidTimeZone: '请输入有效的 IANA 时区，例如 Asia/Shanghai。',
        closeReport: '收起报告', generatedAt: '生成于 {time}', elapsedSeconds: '用时 {seconds} 秒', elapsedMinutes: '用时 {minutes} 分钟', openReport: '打开报告：{title}',
        localBadge: '本地整理', aiBadge: 'AI 报告', reportHint: '报告可继续编辑，也能复制或下载 Markdown。',
      },
      en: {
        panel: 'DSH Journal', subtitle: 'Turn conversations and recorded changes into a work report.',
        day: 'Daily', week: 'Weekly', month: 'Monthly', custom: 'Custom',
        start: 'Start date', end: 'End date', timeZone: 'Time zone',
        timeZoneHint: 'Dates use this time zone and include both the start and end days.',
        scan: 'Scan records', scanning: 'Scanning…', generate: 'Generate report', generating: 'Generating…',
        generatingHint: 'Organizing your work in this period. Longer records are summarized before the report is written.',
        cancel: 'Cancel', cancelled: 'Request cancelled.', loading: 'Loading…', retry: 'Retry',
        mode: 'Report format', ai: 'AI work report', local: 'Local record summary',
        aiHint: 'Generating sends records in this range to the report model: {model}.',
        aiUnavailable: 'The report model is unavailable. Generate a local record summary, or check DSH model settings.',
        localHint: 'Organize records and changes by session on this computer, without a model call.',
        sessions: 'Sessions', messages: 'Messages', tools: 'Tool calls', changes: 'File operations', failures: 'Failed calls',
        coverage: 'Record coverage', coverageIncomplete: 'Some records could not be read, so this report may be incomplete.', sourceSessions: 'Source sessions', noSessions: 'No records were found in this date range.',
        sourceHint: 'Includes only activity recorded within the selected dates. Titles and working directories identify the source.',
        untitled: 'Untitled session', noWorkspace: 'No working directory recorded', sessionId: 'Session ID',
        report: 'Work report', read: 'Read', edit: 'Edit Markdown', save: 'Save changes', saving: 'Saving…',
        unsaved: 'Unsaved changes', saved: 'Changes saved.', markdown: 'Report Markdown',
        copy: 'Copy', copied: 'Copied.', copyFailed: 'Clipboard access failed. Select and copy text in edit mode, or download Markdown.',
        download: 'Download Markdown', history: 'Report history', historyEmpty: 'Generated reports will be saved here.',
        emptyTitle: 'Choose a date range to create a work report',
        emptyDescription: 'Scan the records to check sources, then choose an AI report or a local summary.',
        initialError: 'Journal data could not be loaded.', requestError: 'The request did not finish. Please try again.',
        invalidDate: 'Select valid start and end dates.', invalidOrder: 'The end date must not precede the start date.',
        invalidTimeZone: 'Enter a valid IANA time zone, such as Asia/Singapore.',
        closeReport: 'Close report', generatedAt: 'Generated {time}', elapsedSeconds: 'Took {seconds}s', elapsedMinutes: 'Took {minutes} min', openReport: 'Open report: {title}',
        localBadge: 'Local summary', aiBadge: 'AI report', reportHint: 'You can edit this report, copy it, or download Markdown.',
      },
    };

    const css = `
      .dsh-journal{height:100%;min-width:0;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit;font-size:14px;line-height:1.5;color-scheme:inherit}
      .dsh-journal *{box-sizing:border-box}
      .dsh-journal .dj-page{width:100%;max-width:1008px;margin:0 auto;padding:28px 24px 48px}
      .dsh-journal .dj-header{padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - 24px));margin-bottom:24px}
      .dsh-journal h1{font-size:20px;line-height:28px;font-weight:500;margin:0 0 5px}
      .dsh-journal h2{font-size:15px;line-height:22px;font-weight:500;margin:0}
      .dsh-journal p{margin:0}
      .dsh-journal .dj-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
      .dsh-journal .dj-form{display:flex;flex-direction:column;gap:16px;padding-bottom:24px;border-bottom:1px solid var(--dsw-alias-border-l2)}
      .dsh-journal button,.dsh-journal input,.dsh-journal select,.dsh-journal textarea{font:inherit;color:inherit}
      .dsh-journal button,.dsh-journal select,.dsh-journal input{min-height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent}
      .dsh-journal button{padding:5px 12px;cursor:pointer;white-space:nowrap;line-height:20px}
      .dsh-journal button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
      .dsh-journal button:disabled{opacity:.45;cursor:default}
      .dsh-journal button:focus-visible,.dsh-journal input:focus-visible,.dsh-journal select:focus-visible,.dsh-journal textarea:focus-visible,.dsh-journal summary:focus-visible{outline:2px solid var(--dsw-alias-link,#4d6bfe);outline-offset:3px}
      .dsh-journal .dj-primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted)}
      .dsh-journal .dj-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
      .dsh-journal .dj-presets{display:flex;flex-wrap:wrap;gap:4px;align-self:flex-start;padding:3px;border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
      .dsh-journal .dj-presets button{border-color:transparent;min-width:68px}
      .dsh-journal .dj-presets button[aria-pressed=true]{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l2);box-shadow:0 1px 2px #00000008}
      .dsh-journal .dj-fields{display:grid;grid-template-columns:minmax(136px,1fr) minmax(136px,1fr) minmax(180px,1.3fr);gap:12px}
      .dsh-journal label.dj-field{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:13px}
      .dsh-journal input,.dsh-journal select{width:100%;min-width:0;padding:5px 9px;background:var(--dsw-alias-bg-base)}
      .dsh-journal select option{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
      .dsh-journal .dj-bottom-row{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}
      .dsh-journal .dj-mode{width:200px}
      .dsh-journal .dj-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .dsh-journal .dj-hint{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
      .dsh-journal .dj-error,.dsh-journal .dj-notice{margin:16px 0;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);font-size:13px;overflow-wrap:anywhere}
      .dsh-journal .dj-error{color:var(--dsw-alias-state-error-primary)}
      .dsh-journal .dj-stats{display:flex;gap:24px;flex-wrap:wrap;padding:18px 0}
      .dsh-journal .dj-stat{display:flex;gap:6px;align-items:baseline}
      .dsh-journal .dj-number{font-size:20px;font-weight:500;font-variant-numeric:tabular-nums}
      .dsh-journal .dj-stat-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsh-journal .dj-warnings{padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:14px}
      .dsh-journal .dj-warnings summary{padding:0;color:inherit}
      .dsh-journal .dj-warnings ul{padding-left:18px;margin:5px 0 0}
      .dsh-journal .dj-coverage-error{margin:0 0 8px;color:var(--dsw-alias-state-error-primary);font-size:13px}
      .dsh-journal .dj-sources{margin:2px 0 20px;font-size:13px}
      .dsh-journal summary{cursor:pointer;color:var(--dsw-alias-label-secondary);padding:5px 0;width:fit-content}
      .dsh-journal .dj-source-list{list-style:none;padding:0;margin:8px 0 0;border-top:1px solid var(--dsw-alias-border-l2)}
      .dsh-journal .dj-source{padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:3px}
      .dsh-journal .dj-source-title{font-weight:500;overflow-wrap:anywhere}
      .dsh-journal .dj-path{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .dsh-journal .dj-source-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}
      .dsh-journal .dj-report{margin-top:24px}
      .dsh-journal .dj-report-header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
      .dsh-journal .dj-report-name{font-size:17px;font-weight:500;line-height:1.5;overflow-wrap:anywhere;margin:0 0 3px}
      .dsh-journal .dj-report-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:12px}
      .dsh-journal .dj-badge{padding:1px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-1)}
      .dsh-journal .dj-tabs{display:flex;gap:4px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l2);margin-top:16px}
      .dsh-journal .dj-tabs button{border-color:transparent;color:var(--dsw-alias-label-secondary)}
      .dsh-journal .dj-tabs button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsh-journal .dj-edit-toolbar{display:flex;gap:12px;align-items:center;justify-content:flex-end;margin:12px 0}
      .dsh-journal .dj-editor{display:block;width:100%;min-height:460px;resize:vertical;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
      .dsh-journal .dj-markdown{padding:18px 0 12px;overflow-wrap:anywhere;line-height:1.8}
      .dsh-journal .dj-markdown h1,.dsh-journal .dj-markdown h2,.dsh-journal .dj-markdown h3,.dsh-journal .dj-markdown h4,.dsh-journal .dj-markdown h5,.dsh-journal .dj-markdown h6{margin:22px 0 9px;font-weight:500;line-height:1.5}
      .dsh-journal .dj-markdown h1{font-size:22px}.dsh-journal .dj-markdown h2{font-size:18px}.dsh-journal .dj-markdown h3{font-size:16px}
      .dsh-journal .dj-markdown>:first-child{margin-top:0}
      .dsh-journal .dj-markdown p{margin:9px 0;white-space:pre-wrap}
      .dsh-journal .dj-markdown ul,.dsh-journal .dj-markdown ol{padding-left:22px;margin:9px 0}
      .dsh-journal .dj-markdown li{margin:3px 0;white-space:pre-wrap}
      .dsh-journal .dj-markdown blockquote{margin:12px 0;padding:4px 14px;border-left:3px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}
      .dsh-journal .dj-markdown code{padding:2px 5px;border-radius:4px;background:var(--dsw-alias-markdown-inline-code);font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
      .dsh-journal .dj-markdown pre{padding:14px;border-radius:8px;background:var(--dsw-alias-markdown-code-block);overflow:auto}
      .dsh-journal .dj-markdown pre code{padding:0;background:transparent;white-space:pre;overflow-wrap:normal}
      .dsh-journal .dj-markdown a{color:var(--dsw-alias-link);text-decoration:underline;text-underline-offset:3px}
      .dsh-journal .dj-markdown hr{border:0;border-top:1px solid var(--dsw-alias-border-l2);margin:20px 0}
      .dsh-journal .dj-table-wrap{overflow:auto}.dsh-journal .dj-markdown table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
      .dsh-journal .dj-markdown th,.dsh-journal .dj-markdown td{text-align:left;border:1px solid var(--dsw-alias-border-l2);padding:7px 10px;min-width:80px}
      .dsh-journal .dj-markdown th{background:var(--dsw-alias-bg-layer-1);font-weight:500}
      .dsh-journal .dj-empty{padding:44px 8px;text-align:center;color:var(--dsw-alias-label-secondary)}
      .dsh-journal .dj-empty-title{font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary);margin:0 0 8px}
      .dsh-journal .dj-history{margin-top:28px;padding-top:20px;border-top:1px solid var(--dsw-alias-border-l2)}
      .dsh-journal .dj-history-list{list-style:none;padding:0;margin:10px 0 0}
      .dsh-journal .dj-history-list li{border-bottom:1px solid var(--dsw-alias-border-l2)}
      .dsh-journal .dj-history-entry{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;border:0;border-radius:6px;padding:10px 8px}
      .dsh-journal .dj-history-entry[aria-current=true]{background:var(--dsw-alias-interactive-bg-hover)}
      .dsh-journal .dj-history-title{display:block;white-space:normal;font-weight:500;overflow-wrap:anywhere}
      .dsh-journal .dj-history-date{display:block;margin-top:3px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      @media(max-width:620px){.dsh-journal .dj-page{padding:24px 16px 36px}.dsh-journal .dj-fields{grid-template-columns:1fr 1fr}.dsh-journal .dj-zone{grid-column:1/-1}.dsh-journal .dj-stats{gap:14px}.dsh-journal .dj-history-entry{align-items:flex-start}.dsh-journal .dj-badge{white-space:nowrap}.dsh-journal .dj-report-header .dj-actions{width:100%}.dsh-journal .dj-header{padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - 16px))}}
    `;

    function dateInZone(zone) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
    }
    function presetDates(preset, zone) {
      let end;
      try { end = dateInZone(zone); } catch { end = dateInZone('UTC'); }
      let start = end;
      if (preset === 'week') {
        const date = new Date(`${end}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        start = date.toISOString().slice(0, 10);
      } else if (preset === 'month') start = `${end.slice(0, 7)}-01`;
      return { start, end };
    }
    function validDate(value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
        && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    }
    function rangeError(form, t) {
      if (!validDate(form.start) || !validDate(form.end)) return t('invalidDate');
      if (form.end < form.start) return t('invalidOrder');
      try { new Intl.DateTimeFormat('en', { timeZone: form.timeZone }).format(); }
      catch { return t('invalidTimeZone'); }
      return '';
    }
    function showTime(value, zone) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      try { return date.toLocaleString(undefined, { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
      catch { return date.toLocaleString(); }
    }
    function warningText(warning) {
      if (typeof warning === 'string') return warning;
      return warning?.message || warning?.description || String(warning?.code || '');
    }
    function inline(text, prefix = '') {
      const parts = String(text).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g);
      return parts.filter(Boolean).map((part, i) => {
        const key = `${prefix}${i}`;
        if (part.startsWith('`') && part.endsWith('`')) return h('code', { key }, part.slice(1, -1));
        if (part.startsWith('**') && part.endsWith('**')) return h('strong', { key }, part.slice(2, -2));
        const match = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
        if (match) return h('a', { key, href: match[2], target: '_blank', rel: 'noopener noreferrer' }, match[1]);
        return part;
      });
    }
    function Markdown({ text, title }) {
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      const nodes = [];
      let i = 0;
      const isSpecial = line => /^\s*$|^\s*```|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+[.)]\s|^>\s?|^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
      const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
      while (i < lines.length) {
        const line = lines[i];
        const key = i;
        if (!line.trim()) { i++; continue; }
        if (/^\s*```/.test(line)) {
          const code = [];
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
          if (i < lines.length) i++;
          nodes.push(h('pre', { key }, h('code', null, code.join('\n'))));
          continue;
        }
        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        if (heading) {
          if (!(i === 0 && heading[1] === '#' && heading[2] === title)) nodes.push(h(`h${heading[1].length}`, { key }, inline(heading[2])));
          i++; continue;
        }
        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { nodes.push(h('hr', { key })); i++; continue; }
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
          const headings = cells(line);
          const rows = [];
          i += 2;
          while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
          nodes.push(h('div', { key, className: 'dj-table-wrap' }, h('table', null,
            h('thead', null, h('tr', null, ...headings.map((cell, j) => h('th', { key: j }, inline(cell))))),
            h('tbody', null, ...rows.map((row, j) => h('tr', { key: j }, ...headings.map((_, col) => h('td', { key: col }, inline(row[col] || '')))))))));
          continue;
        }
        const list = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(line);
        if (list) {
          const ordered = !!list[2];
          const items = [];
          const start = ordered ? Number(list[2]) : undefined;
          while (i < lines.length) {
            const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(lines[i]);
            if (!item || !!item[2] !== ordered) break;
            items.push(h('li', { key: i }, inline(item[3])));
            i++;
          }
          nodes.push(h(ordered ? 'ol' : 'ul', { key, ...(ordered ? { start } : {}) }, ...items));
          continue;
        }
        if (/^>\s?/.test(line)) {
          const quote = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
          nodes.push(h('blockquote', { key }, h('p', null, inline(quote.join('\n')))));
          continue;
        }
        const paragraph = [line];
        i++;
        while (i < lines.length && !isSpecial(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && /\|?\s*:?-{3,}/.test(lines[i + 1]))) paragraph.push(lines[i++]);
        nodes.push(h('p', { key }, inline(paragraph.join('\n'))));
      }
      return h('div', { className: 'dj-markdown' }, ...nodes);
    }
    function Warnings({ warnings = [], t }) {
      const items = warnings.map(warningText).filter(Boolean);
      const incomplete = warnings.some(warning => {
        const code = typeof warning === 'object' && warning ? String(warning.code || '') : '';
        return /READ_(?:FAILED|ERROR)|INVALID_EVENTS|MISSING_SESSION_ID/i.test(code)
          || /读取失败|无法读取|报告覆盖不完整|事件格式无效|could not be read|failed to read|read(?:ing)? failed|coverage.{0,20}incomplete/i.test(warningText(warning));
      });
      return items.length ? h('div', null,
        incomplete ? h('p', { className: 'dj-coverage-error', role: 'alert' }, t('coverageIncomplete')) : null,
        h('details', { className: 'dj-warnings' }, h('summary', null, t('coverage')),
          h('ul', null, ...items.map((item, index) => h('li', { key: index }, item))))) : null;
    }
    function elapsedTime(milliseconds, t) {
      if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) return null;
      return milliseconds < 60000
        ? t('elapsedSeconds', { seconds: Math.round(milliseconds / 1000) })
        : t('elapsedMinutes', { minutes: Math.round(milliseconds / 6000) / 10 });
    }
    function Stats({ stats = {}, t }) {
      return h('div', { className: 'dj-stats', 'aria-label': t('report') },
        ...[['sessionCount', 'sessions'], ['messageCount', 'messages'], ['toolCount', 'tools'], ['changeCount', 'changes'], ['failedToolCount', 'failures']].map(([key, label]) =>
          h('div', { className: 'dj-stat', key }, h('span', { className: 'dj-number' }, stats[key] ?? 0), h('span', { className: 'dj-stat-label' }, t(label)))));
    }
    function Sources({ sessions = [], t, zone }) {
      if (!sessions.length) return null;
      return h('details', { className: 'dj-sources' },
        h('summary', null, `${t('sourceSessions')} · ${sessions.length}`),
        h('p', { className: 'dj-hint' }, t('sourceHint')),
        h('ul', { className: 'dj-source-list' }, ...sessions.map(session => h('li', { className: 'dj-source', key: session.id },
          h('span', { className: 'dj-source-title' }, session.title || t('untitled')),
          h('span', { className: 'dj-path' }, session.cwd || t('noWorkspace')),
          h('span', { className: 'dj-source-meta' }, `${session.messageCount ?? 0} ${t('messages')} · ${session.changeCount ?? 0} ${t('changes')}${session.startTime ? ` · ${showTime(session.startTime, zone)}` : ''}`),
          h('span', { className: 'dj-source-meta' }, `${t('sessionId')}: ${session.id}`)))));
    }
    function JournalIcon({ size = 18 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2.5 }),
        h('path', { d: 'M8 3v18M11 8h5M11 12h5M11 16h3' }));
    }
    async function api(path, options = {}, signal) {
      const transport = window.__DSH_TRANSPORT__;
      const send = transport?.fetch ? transport.fetch.bind(transport) : window.fetch.bind(window);
      const response = await send(`api/dsh-journal${path}`, {
        ...options, ...(signal ? { signal } : {}),
        headers: { 'content-type': 'application/json', ...options.headers },
      });
      let body;
      try { body = await response.json(); } catch { throw new Error(`HTTP ${response.status}`); }
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : body?.error?.message || body?.message || `HTTP ${response.status}`);
      return body;
    }
    function JournalPage({ t }) {
      const initialZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [form, setForm] = useState(() => ({ ...presetDates('day', initialZone), timeZone: initialZone, preset: 'day' }));
      const [model, setModel] = useState({ available: false });
      const [mode, setMode] = useState('ai');
      const [history, setHistory] = useState([]);
      const [initialLoading, setInitialLoading] = useState(true);
      const [initialError, setInitialError] = useState('');
      const [preview, setPreview] = useState(null);
      const [report, setReport] = useState(null);
      const [editing, setEditing] = useState(false);
      const [drafts, setDrafts] = useState({});
      const [busy, setBusy] = useState('');
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const requests = useRef(new Set());
      const currentRequest = useRef(null);
      const mounted = useRef(false);
      const draft = report ? drafts[report.id] ?? report.markdown : '';
      const dirty = !!report && draft !== report.markdown;
      const validation = rangeError(form, t);
      const activeEvidence = report || preview;
      const blocked = !!busy || initialLoading;
      const begin = () => { const controller = new AbortController(); requests.current.add(controller); return controller; };
      const end = controller => { requests.current.delete(controller); if (currentRequest.current === controller) currentRequest.current = null; };
      async function loadState() {
        const controller = begin();
        setInitialLoading(true); setInitialError('');
        try {
          const state = await api('/state', {}, controller.signal);
          if (!mounted.current) return;
          setHistory(state.reports || []);
          setModel(state.model || { available: false });
          setMode(previous => state.model?.available ? previous : 'local');
        } catch (failure) {
          if (mounted.current && !controller.signal.aborted) {
            setInitialError(failure.message || t('initialError'));
            setModel({ available: false });
            setMode('local');
          }
        } finally {
          end(controller);
          if (mounted.current) setInitialLoading(false);
        }
      }
      useEffect(() => {
        mounted.current = true;
        void loadState();
        return () => {
          mounted.current = false;
          for (const controller of requests.current) controller.abort();
          requests.current.clear();
        };
      }, []);
      function changeForm(patch) {
        setForm(previous => ({ ...previous, ...patch }));
        setPreview(null); setError(''); setNotice('');
      }
      function selectPreset(preset) {
        changeForm({ preset, ...(preset === 'custom' ? {} : presetDates(preset, form.timeZone)) });
      }
      function changeZone(timeZone) {
        let dates = {};
        if (form.preset !== 'custom') {
          try {
            new Intl.DateTimeFormat('en', { timeZone }).format();
            dates = presetDates(form.preset, timeZone);
          } catch { /* Keep the date fields while a time zone is being typed. */ }
        }
        changeForm({ timeZone, ...dates });
      }
      async function run(kind, action) {
        if (currentRequest.current) return;
        const controller = begin();
        currentRequest.current = controller;
        setBusy(kind); setError(''); setNotice('');
        try { await action(controller.signal); }
        catch (failure) {
          if (mounted.current) {
            if (controller.signal.aborted) setNotice(t('cancelled'));
            else setError(failure.message || t('requestError'));
          }
        } finally {
          end(controller);
          if (mounted.current) setBusy('');
        }
      }
      function scan() {
        if (validation) { setError(validation); return; }
        void run('scan', async signal => {
          const result = await api('/preview', { method: 'POST', body: JSON.stringify(form) }, signal);
          if (!mounted.current) return;
          setPreview(result); setReport(null); setEditing(false);
        });
      }
      function generate() {
        if (validation) { setError(validation); return; }
        void run('generate', async signal => {
          const result = await api('/generate', { method: 'POST', body: JSON.stringify({ ...form, mode }) }, signal);
          if (!mounted.current) return;
          setReport(result); setEditing(false);
          setHistory(previous => [result, ...previous.filter(item => item.id !== result.id)]);
        });
      }
      function openReport(id) {
        void run('open', async signal => {
          const result = await api(`/report?id=${encodeURIComponent(id)}`, {}, signal);
          if (!mounted.current) return;
          setReport(result); setEditing(false);
        });
      }
      function save() {
        if (!report || !dirty) return;
        void run('save', async signal => {
          const result = await api('/report', { method: 'PUT', body: JSON.stringify({ id: report.id, markdown: draft }) }, signal);
          if (!mounted.current) return;
          setReport(result);
          setDrafts(previous => { const next = { ...previous }; delete next[result.id]; return next; });
          setHistory(previous => previous.map(item => item.id === result.id ? result : item));
          setNotice(t('saved'));
        });
      }
      async function copy() {
        try {
          await navigator.clipboard.writeText(draft);
          if (mounted.current) { setNotice(t('copied')); setError(''); }
        } catch { if (mounted.current) setError(t('copyFailed')); }
      }
      function download() {
        if (!report) return;
        const url = URL.createObjectURL(new Blob([draft], { type: 'text/markdown;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${String(report.title || 'DSH Journal').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 120)}.md`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      const field = (key, label) => h('label', { className: 'dj-field', key },
        h('span', null, t(label)),
        h('input', { type: 'date', value: form[key], disabled: blocked, required: true,
          ...(key === 'end' ? { min: form.start } : { max: form.end }),
          onChange: event => changeForm({ [key]: event.target.value, preset: 'custom' }) }));
      return h('section', { className: 'dsh-journal', 'aria-label': t('panel') },
        h('style', null, css),
        h('div', { className: 'dj-page' },
          h('header', { className: 'dj-header' }, h('h1', null, t('panel')), h('p', { className: 'dj-muted' }, t('subtitle'))),
          h('form', { className: 'dj-form', onSubmit: event => { event.preventDefault(); generate(); } },
            h('div', { className: 'dj-presets', role: 'group', 'aria-label': t('custom') },
              ...['day', 'week', 'month', 'custom'].map(preset => h('button', { key: preset, type: 'button', disabled: blocked, 'aria-pressed': form.preset === preset, onClick: () => selectPreset(preset) }, t(preset)))),
            h('div', { className: 'dj-fields' }, field('start', 'start'), field('end', 'end'),
              h('label', { className: 'dj-field dj-zone' }, h('span', null, t('timeZone')),
                h('input', { type: 'text', value: form.timeZone, list: 'dsh-journal-timezones', disabled: blocked, required: true, spellCheck: false, 'aria-describedby': 'dsh-journal-zone-hint',
                  onChange: event => changeZone(event.target.value) }),
                h('datalist', { id: 'dsh-journal-timezones' }, ...[...new Set([initialZone, 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles'])].map(zone => h('option', { value: zone, key: zone }))))),
            h('p', { className: 'dj-hint', id: 'dsh-journal-zone-hint' }, t('timeZoneHint')),
            h('div', { className: 'dj-bottom-row' },
              h('label', { className: 'dj-field dj-mode' }, h('span', null, t('mode')),
                h('select', { value: mode, disabled: blocked, onChange: event => setMode(event.target.value) },
                  h('option', { value: 'ai', disabled: !model.available }, t('ai')), h('option', { value: 'local' }, t('local')))),
              h('div', { className: 'dj-actions' },
                busy ? h('button', { type: 'button', onClick: () => currentRequest.current?.abort() }, t('cancel')) : null,
                h('button', { type: 'button', onClick: scan, disabled: blocked || !!validation }, busy === 'scan' ? t('scanning') : t('scan')),
                h('button', { type: 'submit', className: 'dj-primary', disabled: blocked || !!validation || (mode === 'ai' && !model.available) }, busy === 'generate' ? t('generating') : t('generate')))),
            h('p', { className: 'dj-hint' }, mode === 'local' ? t('localHint') : model.available ? t('aiHint', { model: [model.provider, model.model].filter(Boolean).join(' / ') }) : t('aiUnavailable')),
            !model.available && mode === 'local' && !initialLoading ? h('p', { className: 'dj-hint' }, t('aiUnavailable')) : null,
            validation ? h('p', { className: 'dj-hint' }, validation) : null),
          initialLoading ? h('p', { className: 'dj-notice', role: 'status' }, t('loading')) : null,
          initialError ? h('div', { className: 'dj-error', role: 'alert' }, initialError, ' ', h('button', { type: 'button', onClick: () => void loadState(), disabled: initialLoading }, t('retry'))) : null,
          error ? h('div', { className: 'dj-error', role: 'alert' }, error) : null,
          notice ? h('div', { className: 'dj-notice', role: 'status', 'aria-live': 'polite' }, notice) : null,
          busy === 'generate' ? h('p', { className: 'dj-notice', role: 'status' }, t('generatingHint')) : busy === 'scan' ? h('p', { className: 'dj-notice', role: 'status' }, t('scanning')) : null,
          busy === 'open' ? h('p', { className: 'dj-notice', role: 'status' }, t('loading')) : null,
          activeEvidence ? h(React.Fragment, null,
            h(Stats, { stats: activeEvidence.stats, t }),
            h(Warnings, { warnings: activeEvidence.warnings, t }),
            h(Sources, { sessions: activeEvidence.sources || activeEvidence.sessions, t, zone: activeEvidence.range?.timeZone || form.timeZone }),
            !report && activeEvidence.stats?.sessionCount === 0 ? h('p', { className: 'dj-muted' }, t('noSessions')) : null) : null,
          report ? h('article', { className: 'dj-report', 'aria-label': report.title || t('report'), 'aria-busy': busy === 'save' },
            h('div', { className: 'dj-report-header' },
              h('div', null, h('h2', { className: 'dj-report-name' }, report.title || t('report')),
                h('div', { className: 'dj-report-meta' }, h('span', { className: 'dj-badge' }, t(report.mode === 'local' ? 'localBadge' : 'aiBadge')),
                  h('span', null, t('generatedAt', { time: showTime(report.createdAt, report.range?.timeZone || form.timeZone) })),
                  elapsedTime(report.generation?.elapsedMs, t) ? h('span', null, elapsedTime(report.generation.elapsedMs, t)) : null),
                report.range?.start ? h('p', { className: 'dj-hint', style: { marginTop: 5 } }, `${report.range.start}${report.range.start === report.range.end ? '' : ` — ${report.range.end}`} · ${report.range.timeZone || form.timeZone}`) : null),
              h('div', { className: 'dj-actions' },
                h('button', { type: 'button', onClick: () => void copy() }, t('copy')),
                h('button', { type: 'button', onClick: download }, t('download')),
                h('button', { type: 'button', disabled: blocked, onClick: () => { setReport(null); setEditing(false); } }, t('closeReport')))),
            h('p', { className: 'dj-hint' }, t('reportHint')),
            h('div', { className: 'dj-tabs', role: 'group', 'aria-label': t('report') },
              h('button', { type: 'button', 'aria-pressed': !editing, onClick: () => setEditing(false) }, t('read')),
              h('button', { type: 'button', 'aria-pressed': editing, onClick: () => setEditing(true) }, t('edit'))),
            editing ? h(React.Fragment, null,
              h('div', { className: 'dj-edit-toolbar' }, dirty ? h('span', { className: 'dj-hint' }, t('unsaved')) : null,
                h('button', { type: 'button', className: 'dj-primary', disabled: blocked || !dirty, onClick: save }, busy === 'save' ? t('saving') : t('save'))),
              h('textarea', { className: 'dj-editor', 'aria-label': t('markdown'), value: draft, disabled: busy === 'save', spellCheck: false,
                onChange: event => setDrafts(previous => ({ ...previous, [report.id]: event.target.value })) })) : h(Markdown, { text: draft, title: report.title })) : !activeEvidence && !initialLoading ?
            h('div', { className: 'dj-empty' }, h('p', { className: 'dj-empty-title' }, t('emptyTitle')), h('p', { className: 'dj-muted' }, t('emptyDescription'))) : null,
          h('section', { className: 'dj-history', 'aria-label': t('history') }, h('h2', null, t('history')),
            history.length ? h('ul', { className: 'dj-history-list' }, ...history.map(item => h('li', { key: item.id },
              h('button', { type: 'button', className: 'dj-history-entry', disabled: blocked, 'aria-current': report?.id === item.id, 'aria-label': t('openReport', { title: item.title || t('report') }), onClick: () => openReport(item.id) },
                h('span', null, h('span', { className: 'dj-history-title' }, item.title || t('report')), h('span', { className: 'dj-history-date' }, showTime(item.createdAt, item.range?.timeZone || form.timeZone))),
                h('span', { className: 'dj-badge' }, t(item.mode === 'local' ? 'localBadge' : 'aiBadge')))))) : h('p', { className: 'dj-muted', style: { marginTop: 10 } }, t('historyEmpty')))));
    }
    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-journal: locale');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, JournalPage));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 10, label: () => t('panel'), locale: NS }, JournalIcon));
      },
    };
  },
});
