<?php

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

cors();

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = preg_replace('#^/+#', '/', $path);

if ($method === 'POST' && $path === '/auth/signup') {
    $data = json_input();
    $name = trim((string) ($data['name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        respond(['error' => 'Name, email, and password are required.'], 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['error' => 'Invalid email address.'], 422);
    }

    if (strlen($password) < 6) {
        respond(['error' => 'Password must be at least 6 characters.'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, subscription, upload_count, created_at)
         VALUES (:name, :email, :password_hash, "free", 0, :created_at)'
    );

    try {
        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':created_at' => gmdate('c'),
        ]);
    } catch (PDOException $exception) {
        respond(['error' => 'An account with this email already exists.'], 409);
    }

    $userId = (int) $pdo->lastInsertId();
    $token = bin2hex(random_bytes(32));
    $sessionStmt = $pdo->prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (:token, :user_id, :created_at)');
    $sessionStmt->execute([
        ':token' => $token,
        ':user_id' => $userId,
        ':created_at' => gmdate('c'),
    ]);

    $user = $pdo->query('SELECT id, name, email, subscription, upload_count FROM users WHERE id = ' . $userId)->fetch();
    respond(['token' => $token, 'user' => user_payload($user)], 201);
}

if ($method === 'POST' && $path === '/auth/login') {
    $data = json_input();
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');

    $stmt = db()->prepare('SELECT * FROM users WHERE email = :email');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(['error' => 'Invalid email or password.'], 401);
    }

    $token = bin2hex(random_bytes(32));
    $sessionStmt = db()->prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (:token, :user_id, :created_at)');
    $sessionStmt->execute([
        ':token' => $token,
        ':user_id' => $user['id'],
        ':created_at' => gmdate('c'),
    ]);

    respond([
        'token' => $token,
        'user' => user_payload($user),
    ]);
}

if ($method === 'GET' && $path === '/auth/me') {
    $user = require_user();
    respond(['user' => user_payload($user)]);
}

if ($method === 'POST' && $path === '/auth/logout') {
    $token = auth_token();
    if ($token !== null) {
        $stmt = db()->prepare('DELETE FROM sessions WHERE token = :token');
        $stmt->execute([':token' => $token]);
    }
    respond(['success' => true]);
}

if ($method === 'POST' && $path === '/subscription/update') {
    $user = require_user();
    $data = json_input();
    $plan = (string) ($data['plan'] ?? '');
    $allowedPlans = ['free', 'basic', 'premium', 'enterprise'];
    if (!in_array($plan, $allowedPlans, true)) {
        respond(['error' => 'Invalid subscription plan.'], 422);
    }

    $stmt = db()->prepare('UPDATE users SET subscription = :subscription WHERE id = :id');
    $stmt->execute([
        ':subscription' => $plan,
        ':id' => $user['id'],
    ]);

    $updated = db()->query('SELECT id, name, email, subscription, upload_count FROM users WHERE id = ' . (int) $user['id'])->fetch();
    respond(['user' => user_payload($updated)]);
}

if ($method === 'GET' && $path === '/usage/status') {
    $user = require_user();
    respond(['user' => user_payload($user)]);
}

if ($method === 'GET' && $path === '/admin/users') {
    $rows = db()->query(
        'SELECT
            users.id,
            users.name,
            users.email,
            users.subscription,
            users.upload_count,
            users.created_at,
            COUNT(sessions.token) AS active_sessions
         FROM users
         LEFT JOIN sessions ON sessions.user_id = users.id
         GROUP BY users.id, users.name, users.email, users.subscription, users.upload_count, users.created_at
         ORDER BY users.id DESC'
    )->fetchAll();

    $users = array_map(
        static function (array $row): array {
            $payload = user_payload($row);
            $payload['createdAt'] = $row['created_at'];
            $payload['activeSessions'] = (int) $row['active_sessions'];
            return $payload;
        },
        $rows
    );

    respond([
        'users' => $users,
        'summary' => [
            'totalUsers' => count($users),
            'freeUsers' => count(array_filter($users, static fn (array $user): bool => $user['subscription'] === 'free')),
            'paidUsers' => count(array_filter($users, static fn (array $user): bool => $user['subscription'] !== 'free')),
        ],
    ]);
}

if ($method === 'POST' && $path === '/usage/consume-upload') {
    $user = require_user();
    $limit = upload_limit_for_subscription($user['subscription']);
    $used = (int) $user['upload_count'];

    if ($limit !== null && $used >= $limit) {
        respond([
            'allowed' => false,
            'error' => 'Free plan upload limit reached. Upgrade your subscription to continue uploading files.',
            'user' => user_payload($user),
        ], 403);
    }

    $stmt = db()->prepare('UPDATE users SET upload_count = upload_count + 1 WHERE id = :id');
    $stmt->execute([':id' => $user['id']]);
    $updated = db()->query('SELECT id, name, email, subscription, upload_count FROM users WHERE id = ' . (int) $user['id'])->fetch();

    respond([
        'allowed' => true,
        'user' => user_payload($updated),
    ]);
}

respond(['error' => 'Not found'], 404);
