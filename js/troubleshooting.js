/* troubleshooting.js – 12 simulated incidents. Outputs are examples, nothing is executed. */
(function (root) {
  'use strict';
  var IP = root.PUBLIC_IP || '203.0.113.25';
  var OK = ['ok', 'OK'];
  var NGINX_OK = '● nginx.service - A high performance web server and a reverse proxy server\n     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)\n     Active: active (running) since Fri 2026-11-13 14:20:41 UTC; 2min ago\n   Main PID: 2217 (nginx)';

  var INCIDENTS = [
    {
      id: 1, title: 'SSH connection timed out', desc: 'ssh hangs for about 30 seconds and ends with “Connection timed out”.',
      cause: 'Network path problem: Security Group has no port 22 rule for your current IP, the instance has no public IP, or its subnet has no route to an internet gateway.',
      effect: { ssh: ['bad', 'Timed out'] }, diag: { c: 'ssh -v -i key.pem ubuntu@' + IP, o: 'debug1: Connecting to ' + IP + ' [' + IP + '] port 22.\nssh: connect to host ' + IP + ' port 22: Connection timed out' },
      fix: { c: 'EC2 console → Security Groups → Inbound rules → Edit: add SSH (22) from “My IP”.\nAlso confirm: public IPv4 assigned, route table has 0.0.0.0/0 → igw-…', o: 'Inbound rule sgr-0a1b… saved: SSH TCP 22 from 198.51.100.7/32' },
      verify: { c: 'ssh -i key.pem ubuntu@' + IP, o: 'Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-1018-aws x86_64)\nubuntu@ip-172-31-24-87:~$' }
    },
    {
      id: 2, title: 'Permission denied (publickey)', desc: 'The server answers, but refuses the login.',
      cause: 'Wrong user name (ec2-user vs ubuntu), wrong key file, or a key that does not match the one chosen at launch.',
      effect: { ssh: ['bad', 'Permission denied'] }, diag: { c: 'ssh -i key.pem ec2-user@' + IP, o: 'ec2-user@' + IP + ': Permission denied (publickey).' },
      fix: { c: 'ssh -i key.pem ubuntu@' + IP, o: 'On Ubuntu AMIs the default user is "ubuntu". Also check you use the .pem that belongs to the key pair selected at launch.' },
      verify: { c: 'whoami', o: 'ubuntu' }
    },
    {
      id: 3, title: 'Port 22 blocked', desc: 'Only your office IP was allowed. You are now on a different network (home, mobile hotspot).',
      cause: 'The SSH rule uses a /32 CIDR of your old public IP. Least privilege works as designed: the new IP is denied.',
      effect: { ssh: ['bad', 'Port 22 blocked'] }, diag: { c: 'nc -vz ' + IP + ' 22   # from your laptop', o: 'nc: connect to ' + IP + ' port 22 (tcp) timed out: Operation now in progress' },
      fix: { c: 'Security Group → edit inbound rule for SSH → Source: My IP (updates the /32 to your current public IP)', o: 'Rule updated: SSH TCP 22 source 198.51.100.42/32' },
      verify: { c: 'nc -vz ' + IP + ' 22', o: 'Connection to ' + IP + ' 22 port [tcp/ssh] succeeded!' }
    },
    {
      id: 4, title: 'HTTP website not loading', desc: 'The browser spins forever on http://' + IP + '.',
      cause: 'Could be the SG, the service or the IP. Split the problem: does curl localhost work on the server?',
      effect: { http: ['bad', 'No response'], site: ['bad', 'Not loading'] }, diag: { c: 'curl -I http://localhost   # run on the server', o: 'HTTP/1.1 200 OK\nServer: nginx/1.24.0 (Ubuntu)\n\n→ NGINX is fine. The block is between the internet and the instance (Security Group / IP).' },
      fix: { c: 'Add inbound rule HTTP (80) from 0.0.0.0/0 to the Security Group.', o: 'Inbound rule saved: HTTP TCP 80 from 0.0.0.0/0' },
      verify: { c: 'curl -I http://' + IP + '   # from your laptop', o: 'HTTP/1.1 200 OK\nServer: nginx/1.24.0 (Ubuntu)' }
    },
    {
      id: 5, title: 'Port 80 blocked', desc: 'curl localhost works, curl from outside times out.',
      cause: 'The Security Group has no HTTP rule, or a network ACL denies port 80.',
      effect: { http: ['bad', 'Port 80 blocked'], site: ['bad', 'Timed out'] }, diag: { c: 'curl -m 5 -I http://' + IP + '   # from your laptop', o: 'curl: (28) Connection timed out after 5001 milliseconds' },
      fix: { c: 'Security Group → Inbound → Add rule: Type HTTP, Port 80, Source 0.0.0.0/0. Check the subnet NACL allows 80 and ephemeral ports.', o: 'Inbound rule saved.' },
      verify: { c: 'curl -I http://' + IP, o: 'HTTP/1.1 200 OK' }
    },
    {
      id: 6, title: 'Incorrect public IP', desc: 'You typed the IP from yesterday. The instance was stopped and started, so it got a new one.',
      cause: 'Auto-assigned public IPv4 addresses change on stop/start. Use an Elastic IP for a fixed address.',
      effect: { site: ['warn', 'Wrong address'], http: ['warn', 'Wrong target'] }, diag: { c: 'EC2 console → instance → “Public IPv4 address”', o: 'Public IPv4 address: ' + IP + '\n(you were using 198.51.100.99 → someone else’s address or nothing at all)' },
      fix: { c: 'Use the current public IP, or allocate and associate an Elastic IP:\naws ec2 allocate-address  &&  aws ec2 associate-address …', o: 'Elastic IP associated. The address no longer changes on stop/start.' },
      verify: { c: 'curl -I http://' + IP, o: 'HTTP/1.1 200 OK' }
    },
    {
      id: 7, title: 'EC2 instance stopped', desc: 'Nothing works: not SSH, not HTTP.',
      cause: 'The instance is in the “stopped” state (manually, or after a scheduled shutdown).',
      effect: { ec2: ['bad', 'Stopped'], ssh: ['bad', 'Unreachable'], ubuntu: ['bad', 'Off'], nginx: ['bad', 'Off'], http: ['bad', 'Unreachable'], site: ['bad', 'Down'] },
      diag: { c: 'aws ec2 describe-instances --instance-ids i-0abc123 --query "Reservations[].Instances[].State.Name" --output text', o: 'stopped' },
      fix: { c: 'aws ec2 start-instances --instance-ids i-0abc123   # or console: Instance state → Start', o: '{ "StartingInstances": [ { "CurrentState": { "Name": "pending" } } ] }\nNote: the public IP will change unless you use an Elastic IP.' },
      verify: { c: 'aws ec2 describe-instance-status --instance-ids i-0abc123 --query "InstanceStatuses[].InstanceStatus.Status" --output text', o: 'ok' }
    },
    {
      id: 8, title: 'NGINX service stopped', desc: 'SSH works, port 80 refuses connections.',
      cause: 'The nginx service is inactive (stopped manually, crashed, or never enabled).',
      effect: { nginx: ['bad', 'inactive (dead)'], http: ['bad', 'Connection refused'], site: ['bad', 'Down'] }, diag: { c: 'sudo systemctl status nginx', o: '○ nginx.service - A high performance web server and a reverse proxy server\n     Active: inactive (dead) since Fri 2026-11-13 14:30:02 UTC; 1min ago' },
      fix: { c: 'sudo systemctl enable --now nginx', o: 'Synchronizing state of nginx.service with SysV service script…\nExecuting: /usr/lib/systemd/systemd-sysv-install enable nginx' },
      verify: { c: 'sudo systemctl status nginx', o: NGINX_OK }
    },
    {
      id: 9, title: 'Website shows the default NGINX page', desc: '“Welcome to nginx!” appears instead of CloudFlix.',
      cause: 'Your files were never copied to /var/www/html (or copied to a sub-folder), so NGINX serves index.nginx-debian.html.',
      effect: { site: ['warn', 'Default page'] }, diag: { c: 'ls /var/www/html', o: 'index.nginx-debian.html' },
      fix: { c: 'cd ~ && sudo cp -r website/* /var/www/html/', o: '(no output = success)' },
      verify: { c: 'curl -s http://localhost | grep -i "<title>"', o: '<title>CloudFlix – Demo Streaming Landing Page</title>' }
    },
    {
      id: 10, title: 'Incorrect website file permissions', desc: 'The browser shows “403 Forbidden”.',
      cause: 'The NGINX worker (user www-data) cannot read the files or traverse a directory, e.g. mode 600 or 700.',
      effect: { site: ['bad', '403 Forbidden'] }, diag: { c: 'sudo tail -n 3 /var/log/nginx/error.log', o: '2026/11/13 14:41:09 [error] 2217#2217: *7 open() "/var/www/html/index.html" failed (13: Permission denied), client: 198.51.100.7' },
      fix: { c: 'sudo find /var/www/html -type d -exec chmod 755 {} \\;\nsudo find /var/www/html -type f -exec chmod 644 {} \\;', o: '(no output = success)' },
      verify: { c: 'curl -I http://localhost', o: 'HTTP/1.1 200 OK' }
    },
    {
      id: 11, title: 'Ubuntu disk space exhausted', desc: 'Writes fail, apt errors, services misbehave.',
      cause: 'The 8 GiB root volume is full: logs, package caches or uploads filled it.',
      effect: { ubuntu: ['bad', 'Disk 100% full'], nginx: ['warn', 'Cannot write logs'], site: ['warn', 'Degraded'] }, diag: { c: 'df -h /', o: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root       6.8G  6.8G     0 100% /' },
      fix: { c: 'sudo apt clean\nsudo journalctl --vacuum-size=100M\nsudo du -xh / --max-depth=2 | sort -h | tail\n# long term: grow the EBS volume, then: sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/root', o: 'Freed 1.4G. Vacuuming done.' },
      verify: { c: 'df -h /', o: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root       6.8G  5.4G  1.4G  80% /' }
    },
    {
      id: 12, title: 'NGINX configuration error', desc: 'sudo systemctl restart nginx fails after you edited a config file.',
      cause: 'A syntax error (e.g. a missing semicolon) in /etc/nginx. NGINX refuses to start with invalid config.',
      effect: { nginx: ['bad', 'failed (config)'], http: ['bad', 'Connection refused'], site: ['bad', 'Down'] }, diag: { c: 'sudo nginx -t', o: 'nginx: [emerg] unexpected "}" in /etc/nginx/sites-enabled/default:12\nnginx: configuration file /etc/nginx/nginx.conf test failed' },
      fix: { c: 'sudo nano +12 /etc/nginx/sites-enabled/default   # add the missing ";" on the previous line\nsudo nginx -t && sudo systemctl restart nginx', o: 'nginx: configuration file /etc/nginx/nginx.conf test is successful' },
      verify: { c: 'sudo systemctl status nginx', o: NGINX_OK }
    }
  ];

  var HEALTH_CHECK = ['EC2 instance running', 'SSH connection working', 'Ubuntu operational', 'NGINX active', 'HTTP port 80 accessible', 'Website successfully loading'];
  var rootEl, solved = {}, sel = null, phase = 0;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function healthOK() { root.Anim.setHealth({ ec2: OK, ssh: OK, ubuntu: OK, nginx: OK, http: OK, site: OK }, 'All systems operational'); }
  function count() { return Object.keys(solved).length; }

  function render() {
    var inc = sel ? INCIDENTS[sel - 1] : null;
    var h = '<div class="ts-top"><h2>🚀 Troubleshooting control room</h2><span class="ts-score" id="tsScore">' + count() + ' / 12 incidents resolved</span></div>';
    h += '<div class="inc-grid" id="incGrid">';
    INCIDENTS.forEach(function (i) { h += '<button type="button" class="inc' + (sel === i.id ? ' on' : '') + (solved[i.id] ? ' solved' : '') + '" data-id="' + i.id + '"><b>' + (solved[i.id] ? '✓' : i.id) + '</b><span>' + esc(i.title) + '</span></button>'; });
    h += '</div><div class="inc-detail" id="incDetail">';
    if (!inc) h += '<p>Select an incident above. For each one you will read the <b>problem</b>, run a <b>diagnostic</b>, apply the <b>corrective action</b> and <b>verify</b> the fix. The tiles in the diagram above turn red while the problem is active.</p>';
    else {
      h += '<h3>' + inc.id + '. ' + esc(inc.title) + '</h3><p><b>Problem:</b> ' + esc(inc.desc) + '</p>';
      h += '<div class="phase' + (phase === 0 ? ' on' : ' done') + '"><h4>1 · Diagnose</h4><p class="t-d">Possible root cause is revealed after you run the diagnostic.</p><button type="button" data-act="diag"' + (phase > 0 ? ' disabled' : '') + '>Run diagnostic</button>';
      if (phase > 0) h += '<p><b>Command:</b></p><pre class="code">$ ' + esc(inc.diag.c) + '</pre><p><b>Expected output:</b></p><pre class="code">' + esc(inc.diag.o) + '</pre><p><b>Root cause:</b> ' + esc(inc.cause) + '</p>';
      h += '</div>';
      if (phase > 0) {
        h += '<div class="phase' + (phase === 1 ? ' on' : ' done') + '"><h4>2 · Corrective action</h4><button type="button" data-act="fix"' + (phase > 1 ? ' disabled' : '') + '>Apply fix</button>';
        if (phase > 1) h += '<pre class="code">$ ' + esc(inc.fix.c) + '</pre><pre class="code">' + esc(inc.fix.o) + '</pre>';
        h += '</div>';
      }
      if (phase > 1) {
        h += '<div class="phase' + (phase === 2 ? ' on' : ' done') + '"><h4>3 · Final verification</h4><button type="button" data-act="verify"' + (phase > 2 ? ' disabled' : '') + '>Verify</button>';
        if (phase > 2) h += '<pre class="code">$ ' + esc(inc.verify.c) + '</pre><pre class="code">' + esc(inc.verify.o) + '</pre><p class="t-g"><b>✔ Resolved.</b> All health tiles are green again.</p>';
        h += '</div>';
      }
    }
    h += '</div><div class="hc"><button type="button" id="hcBtn">Run final health check</button><button type="button" id="tsReset" style="background:var(--panel2);color:var(--text);border:1px solid var(--line)">Reset incidents</button><span id="hcMsg" class="ts-score"></span></div><ul class="hc-list" id="hcList">' + HEALTH_CHECK.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    rootEl.innerHTML = h;
  }

  function select(id) { sel = id; phase = 0; healthOK(); root.Anim.setHealth(INCIDENTS[id - 1].effect, 'INCIDENT ' + id + ': ' + INCIDENTS[id - 1].title); render(); }

  function onClick(e) {
    var b = e.target.closest('button'); if (!b || !rootEl.contains(b)) return;
    if (b.classList.contains('inc')) return select(+b.getAttribute('data-id'));
    var act = b.getAttribute('data-act');
    if (act === 'diag') { phase = 1; render(); }
    else if (act === 'fix') { phase = 2; render(); }
    else if (act === 'verify') { phase = 3; solved[sel] = true; healthOK(); render(); }
    else if (b.id === 'tsReset') { solved = {}; sel = null; phase = 0; healthOK(); render(); }
    else if (b.id === 'hcBtn') {
      var lis = rootEl.querySelectorAll('#hcList li'), msg = rootEl.querySelector('#hcMsg'); healthOK(); sel = null; var n = 0;
      lis.forEach(function (li) { li.classList.remove('on'); }); msg.textContent = 'Running checks…';
      (function next() { if (n < lis.length) { lis[n].classList.add('on'); lis[n].textContent = '✔ ' + HEALTH_CHECK[n]; n++; setTimeout(next, 350); } else { msg.textContent = '✔ Production ready: all 6 checks passed'; } })();
    }
  }

  function init(el) { rootEl = el; rootEl.addEventListener('click', onClick); render(); }
  function reset() { solved = {}; sel = null; phase = 0; if (rootEl) render(); }
  root.Troubleshoot = { init: init, reset: reset, incidents: INCIDENTS, select: select, get solved() { return count(); } };
})(window);
