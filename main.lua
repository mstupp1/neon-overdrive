-- NEON GLITCH HELL: OVERDRIVE (LÖVE 2D REBUILD)
-- Desktop-focused port of the browser version, preserving gameplay/visual rhythm

local TIME_STEP = 1 / 60
local SCORE_DIGITS = 10
local PLAYER_MAX_LIVES = 6

local PLAYFIELD_SIDE_PADDING = 24
local PLAYFIELD_TOP_BUFFER = 24
local PLAYFIELD_BOTTOM_PADDING = 40
local PLAYER_START_BOTTOM_OFFSET = 60

local PLAYER_MAX_SPEED = 6
local PLAYER_MAX_SPEED_UP = 7.5
local PLAYER_MAX_SPEED_DOWN = 5.25
local PLAYER_ACCEL = 0.55
local PLAYER_ACCEL_UP_BOOST = 1.25
local PLAYER_ACCEL_DOWN_FACTOR = 0.8
local PLAYER_FRICTION = 0.9
local PLAYER_TILT_MAX = 0.25
local PLAYER_TILT_DEADZONE = 0.8
local PLAYER_TILT_BLEND = 0.08
local PLAYER_TILT_DAMP = 0.98

local width, height = 1280, 720
local hudTopHeight = 80

local gameState = "DEMO"
local frameCount = 0
local globalHue = 0
local score = 0
local accumulator = 0
local flashAlpha = 0
local flashDecay = 2.2

local fonts = {}
local activeButtons = {}

local input = { x = 0, y = 0, active = false, lastX = 0, lastY = 0 }

local player = {
  x = 0, y = 0, radius = 6,
  w = 24, h = 32,
  lives = PLAYER_MAX_LIVES, iframes = 0, powerLevel = 1, maxPower = 6,
  hasShield = false,
  tail = {},
  vx = 0, vy = 0, tilt = 0, tiltDir = 1,
}

local bullets, enemies, particles, powerups, texts = {}, {}, {}, {}, {}
local spawnBullet, spawnEnemyEntity, spawnParticle, spawnPowerup, spawnText

-- Helpers --------------------------------------------------------------
local function clamp(v, mn, mx) return math.max(mn, math.min(mx, v)) end
local function rand(min, max) return love.math.random() * (max - min) + min end
local function dist(x1, y1, x2, y2) return ((x2 - x1) ^ 2 + (y2 - y1) ^ 2) ^ 0.5 end
local function lerp(a, b, t) return a + (b - a) * t end
local function sign(x) return (x > 0 and 1) or (x < 0 and -1) or 0 end

local function hexToRgb(hex, a)
  hex = hex:gsub("#", "")
  local r = tonumber(hex:sub(1, 2), 16)
  local g = tonumber(hex:sub(3, 4), 16)
  local b = tonumber(hex:sub(5, 6), 16)
  return r / 255, g / 255, b / 255, a or 1
end

local function hslToRgb(h, s, l, a)
  h = h % 360
  local c = (1 - math.abs(2 * l - 1)) * s
  local x = c * (1 - math.abs((h / 60) % 2 - 1))
  local m = l - c / 2
  local r, g, b = 0, 0, 0
  if h < 60 then r, g, b = c, x, 0 elseif h < 120 then r, g, b = x, c, 0 elseif h < 180 then r, g, b = 0, c, x elseif h < 240 then r, g, b = 0, x, c elseif h < 300 then r, g, b = x, 0, c else r, g, b = c, 0, x end
  return r + m, g + m, b + m, a or 1
end

local function drawGlowCircle(x, y, radius, r, g, b, strength)
  strength = strength or 1
  love.graphics.setBlendMode("add")
  for i = 6, 1, -1 do
    local alpha = (i / 6) ^ 2 * 0.35 * strength
    love.graphics.setColor(r, g, b, alpha)
    love.graphics.circle("fill", x, y, radius + i * 2)
  end
  love.graphics.setColor(r, g, b, 1)
  love.graphics.circle("fill", x, y, radius)
  love.graphics.setBlendMode("alpha")
end

local function drawGlowRect(x, y, w, h, r, g, b, strength)
  strength = strength or 1
  love.graphics.setBlendMode("add")
  for i = 4, 1, -1 do
    local alpha = (i / 4) ^ 2 * 0.25 * strength
    love.graphics.setColor(r, g, b, alpha)
    love.graphics.rectangle("fill", x - i, y - i, w + i * 2, h + i * 2)
  end
  love.graphics.setColor(r, g, b, 1)
  love.graphics.rectangle("fill", x, y, w, h)
  love.graphics.setBlendMode("alpha")
end

-- Object Pool ---------------------------------------------------------
local Pool = {}
Pool.__index = Pool
function Pool:new(factory, maxSize)
  return setmetatable({ pool = {}, factory = factory, maxSize = maxSize or 200 }, self)
end
function Pool:get(...)
  local obj = table.remove(self.pool)
  if not obj then obj = self.factory() end
  if obj.init then obj:init(...) end
  return obj
end
function Pool:release(obj)
  if #self.pool < self.maxSize then
    table.insert(self.pool, obj)
  end
end

-- Entities ------------------------------------------------------------
local Bullet = {}
Bullet.__index = Bullet
function Bullet:new()
  return setmetatable({ active = false }, self)
end
function Bullet:init(x, y, angle, speed, bulletType, subType)
  self.x, self.y = x, y
  self.vx, self.vy = math.cos(angle) * speed, math.sin(angle) * speed
  self.angle, self.speed = angle, speed
  self.type = bulletType
  self.subType = subType or "normal"
  self.active = true
  self.radius = 8
  self.timer = 0
  self.rotation = 0
  self.life = 1
end
function Bullet:update()
  self.timer = self.timer + 1
  self.x = self.x + self.vx
  self.y = self.y + self.vy

  if self.subType == "homing" then
    local target, minDist = nil, 400
    if frameCount % 4 == 0 then
      for _, e in ipairs(enemies) do
        if e.active then
          local d = dist(self.x, self.y, e.x, e.y)
          if d < minDist and e.y > 0 then minDist, target = d, e end
        end
      end
    end
    if target then
      local angleTo = math.atan(target.y - self.y, target.x - self.x)
      local diff = angleTo - self.angle
      while diff < -math.pi do diff = diff + math.pi * 2 end
      while diff > math.pi do diff = diff - math.pi * 2 end
      self.angle = self.angle + diff * 0.15
      self.vx = math.cos(self.angle) * self.speed
      self.vy = math.sin(self.angle) * self.speed
    end
  elseif self.subType == "blade" then
    self.rotation = self.rotation + 0.3
    self.vx = self.vx * 0.99
    self.vy = self.vy * 0.99
    self.life = self.life - 0.005
    if self.life <= 0 then self.active = false end
  end

  local bounds = self.type == "enemy" and 300 or 50
  if self.x < -bounds or self.x > width + bounds or self.y < -bounds or self.y > height + bounds then
    self.active = false
  end
end
function Bullet:draw()
  if self.type == "enemy" then
    local r, g, b = hexToRgb("#ff0000")
    drawGlowCircle(self.x, self.y, 6, r, g, b, 1.1)
  else
    if self.subType == "beam" then
      local r, g, b = hexToRgb("#00ffff")
      love.graphics.push()
      love.graphics.translate(self.x, self.y)
      love.graphics.rotate(self.angle + math.pi / 2)
      drawGlowRect(-6, -20, 12, 40, r, g, b, 1.2)
      love.graphics.pop()
    elseif self.subType == "homing" then
      local r, g, b = hexToRgb("#d000ff")
      drawGlowCircle(self.x, self.y, 7, r, g, b, 1)
    elseif self.subType == "wave" then
      local r, g, b = hexToRgb("#5030ff")
      drawGlowCircle(self.x, self.y, 8, r, g, b, 1.2)
    elseif self.subType == "blade" then
      local r, g, b = hexToRgb("#00ffff")
      love.graphics.push()
      love.graphics.translate(self.x, self.y)
      love.graphics.rotate(self.rotation)
      love.graphics.setColor(r, g, b, math.max(0, self.life))
      love.graphics.setBlendMode("add")
      love.graphics.rectangle("fill", -20, -3, 40, 6)
      love.graphics.rectangle("fill", -3, -20, 6, 40)
      love.graphics.setBlendMode("alpha")
      love.graphics.pop()
    else
      local r, g, b = hexToRgb("#00ffff")
      drawGlowCircle(self.x, self.y, 6, r, g, b, 1)
    end
  end
end

local Enemy = {}
Enemy.__index = Enemy
function Enemy:new()
  return setmetatable({ active = false, segments = {} }, self)
end
function Enemy:init(type)
  self.type = type
  self.active = true
  self.hp = 1
  self.timer = 0
  self.state = "move"
  self.fireTimer = 0
  self.flashTimer = 0
  self.fade = 1
  self.inactive = false
  self.vx, self.vy = 0, 0

  local spawnMargin = 50
  self.x = rand(spawnMargin, width - spawnMargin)
  self.y = -40

  if type == "chaser" then
    self.hp = 4; self.radius = 18; self.speed = rand(2, 3.5)
  elseif type == "spinner" then
    self.hp = 15; self.radius = 25; self.speed = 1.5
  elseif type == "dasher" then
    self.hp = 3; self.radius = 12; self.speed = 6
    local a = math.atan(player.y - self.y, player.x - self.x)
    self.vx = math.cos(a) * self.speed
    self.vy = math.sin(a) * self.speed
  elseif type == "snake" then
    self.hp = 20; self.radius = 15
    self.segments = {}
    for i = 1, 8 do table.insert(self.segments, { x = self.x, y = self.y - i * 15 }) end
  elseif type == "sniper" then
    self.hp = 6; self.radius = 20
    self.tx, self.ty = rand(50, width - 50), rand(50, height * 0.4)
  end
end
function Enemy:update()
  if self.flashTimer > 0 then self.flashTimer = self.flashTimer - 1 end

  local bottomHudHeight = 80
  local fadeBuffer = 140
  local fadeStart = height - (bottomHudHeight + fadeBuffer)
  local fadeEnd = height - bottomHudHeight + 10
  local inFadeZone = self.y >= fadeStart
  local fadeT = inFadeZone and math.min(1, (self.y - fadeStart) / (fadeEnd - fadeStart)) or 0
  self.fade = 1 - fadeT
  self.inactive = inFadeZone
  local allowFire = not self.inactive

  if self.type == "chaser" then
    local a = math.atan(player.y - self.y, player.x - self.x)
    self.x = self.x + math.cos(a) * self.speed
    self.y = self.y + math.max(1, math.sin(a) * self.speed)
    self.fireTimer = self.fireTimer + 1
    if allowFire and self.fireTimer > 90 then
      self.fireTimer = 0
      spawnBullet(self.x, self.y, a + rand(-0.2, 0.2), 7, "enemy")
    end
  elseif self.type == "spinner" then
    self.y = self.y + 0.8
    self.x = self.x + math.sin(frameCount * 0.03)
    self.timer = self.timer + 1
    if allowFire and self.timer > 45 then
      self.timer = 0
      for i = 0, 5 do
        spawnBullet(self.x, self.y, i * (math.pi / 3) + frameCount * 0.1, 9, "enemy")
      end
    end
  elseif self.type == "dasher" then
    self.x = self.x + self.vx
    self.y = self.y + self.vy
    self.fireTimer = self.fireTimer + 1
    if allowFire and self.fireTimer > 70 then
      self.fireTimer = 0
      local backAngle = math.atan(self.vy, self.vx) + math.pi
      spawnBullet(self.x, self.y, backAngle + rand(-0.15, 0.15), 8, "enemy")
    end
  elseif self.type == "snake" then
    self.x = self.x + math.sin(frameCount * 0.05) * 3
    self.y = self.y + 2
    local p = { x = self.x, y = self.y }
    for _, s in ipairs(self.segments) do
      s.x = s.x + (p.x - s.x) * 0.3
      s.y = s.y + (p.y - s.y) * 0.3
      p = { x = s.x, y = s.y }
    end
  elseif self.type == "sniper" then
    if self.state == "move" then
      self.x = self.x + (self.tx - self.x) * 0.05
      self.y = self.y + (self.ty - self.y) * 0.05
      if math.abs(self.x - self.tx) < 5 then self.state = "aim"; self.timer = 0 end
    elseif self.state == "aim" then
      self.timer = self.timer + 1
      if allowFire and self.timer > 50 then
        local a = math.atan(player.y - self.y, player.x - self.x)
        spawnBullet(self.x, self.y, a, 15, "enemy")
        self.tx, self.ty = rand(50, width - 50), rand(50, height * 0.4)
        self.state = "move"
      end
    end
  end

  if inFadeZone then
    local exitDrift = 1.5 + fadeT * 2.5
    self.y = self.y + exitDrift
    self.vx = (self.vx or 0) * 0.92
    self.vy = (self.vy or 0) * 0.92
  end

  local edgeMargin = 60
  if self.x < edgeMargin then self.x = self.x + (edgeMargin - self.x) * 0.05 elseif self.x > width - edgeMargin then self.x = self.x - (self.x - (width - edgeMargin)) * 0.05 end
  if self.y < edgeMargin then self.y = self.y + (edgeMargin - self.y) * 0.05 elseif self.y > height - edgeMargin then self.y = self.y - (self.y - (height - edgeMargin)) * 0.05 end

  if self.y > height + 100 or self.x < -100 or self.x > width + 100 then self.active = false end
end
function Enemy:draw()
  love.graphics.push()
  love.graphics.translate(self.x, self.y)

  local baseAlpha = self.fade or 1
  local flashStrength = self.flashTimer > 0 and (self.flashTimer / 8) or 0
  if flashStrength > 0 then
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 1, 1, baseAlpha * (0.5 + flashStrength * 0.5))
  else
    love.graphics.setBlendMode("alpha")
  end

  if self.type == "chaser" then
    love.graphics.rotate(math.atan(player.y - self.y, player.x - self.x) - math.pi / 2)
    local r, g, b = hexToRgb("#ff0000")
    drawGlowTriangle(0, 0, 30, r, g, b, baseAlpha)
  elseif self.type == "spinner" then
    love.graphics.rotate(frameCount * 0.1)
    local r, g, b = hexToRgb("#ff00ff")
    drawGlowCircle(0, 0, 30, r, g, b, baseAlpha)
    for i = 0, 3 do
      love.graphics.push()
      love.graphics.rotate(i * math.pi / 2)
      drawGlowRect(15, -4, 20, 8, r, g, b, baseAlpha)
      love.graphics.pop()
    end
  elseif self.type == "dasher" then
    love.graphics.rotate(math.atan(self.vy, self.vx) + math.pi / 2)
    local r, g, b = hexToRgb("#ffff00")
    drawGlowTriangle(0, 0, 26, r, g, b, baseAlpha)
  elseif self.type == "snake" then
    local r, g, b = hexToRgb("#ff0000")
    drawGlowCircle(0, 0, 20, r, g, b, baseAlpha)
    love.graphics.pop(); love.graphics.push();
    love.graphics.setBlendMode("add")
    for i, s in ipairs(self.segments) do
      local alpha = baseAlpha * (1 - i / 10)
      love.graphics.setColor(1, 0.2, 0.2, alpha)
      love.graphics.circle("fill", s.x, s.y, 10 - i)
    end
  elseif self.type == "sniper" then
    local r, g, b = hexToRgb("#ff4444")
    drawGlowRect(-15, -15, 30, 30, r, g, b, baseAlpha)
    if self.state == "aim" then
      love.graphics.pop(); love.graphics.push()
      love.graphics.setBlendMode("alpha")
      love.graphics.setColor(1, 0, 0, baseAlpha * (self.timer / 50))
      love.graphics.setLineWidth(2)
      love.graphics.line(self.x, self.y, player.x, player.y)
    end
  end
  love.graphics.pop()
end

local PowerUp = {}
PowerUp.__index = PowerUp
function PowerUp:new()
  return setmetatable({ active = false }, self)
end
function PowerUp:init(x, y, type, isKnockout)
  self.x, self.y = x, y
  self.active = true
  self.radius = 16
  self.isKnockout = isKnockout
  if isKnockout then
    local a = love.math.random() * math.pi * 2
    self.vx, self.vy = math.cos(a) * 6, math.sin(a) * 6
  else
    self.vx, self.vy = 0, 2
  end

  if type then
    self.type = type
  else
    local r = love.math.random()
    if r > 0.97 then self.type = "bomb"
    elseif r > 0.90 then self.type = "shield"
    elseif r > 0.80 then self.type = "life"
    else self.type = "weapon" end
  end
end
function PowerUp:update()
  self.x = self.x + self.vx
  self.y = self.y + self.vy
  if self.isKnockout then
    self.vx = self.vx * 0.95
    self.vy = self.vy * 0.95
    if self.x < 0 or self.x > width then self.vx = -self.vx end
    if self.y < 0 or self.y > height then self.vy = -self.vy end
  end
  if self.y > height + 50 then self.active = false end
end
function PowerUp:draw()
  love.graphics.push()
  love.graphics.translate(self.x, self.y)
  local s = 1 + math.sin(frameCount * 0.2) * 0.3
  love.graphics.scale(s, s)

  local c, t = { 1, 1, 1 }, "?"
  if self.type == "weapon" then c, t = { 0, 1, 1 }, "W" elseif self.type == "bomb" then c, t = { 1, 1, 0 }, "B" elseif self.type == "shield" then c, t = { 0, 0.4, 1 }, "S" elseif self.type == "life" then c, t = { 1, 0, 0 }, "♥" end

  love.graphics.setBlendMode("add")
  love.graphics.setColor(c[1], c[2], c[3], 0.25)
  love.graphics.circle("fill", 0, 0, self.radius + 6)
  love.graphics.setBlendMode("alpha")
  love.graphics.setLineWidth(3)
  love.graphics.setColor(c[1], c[2], c[3], 1)
  love.graphics.circle("line", 0, 0, self.radius)
  love.graphics.setFont(fonts.hud)
  love.graphics.printf(t, -self.radius, -fonts.hud:getHeight() / 2 + 2, self.radius * 2, "center")
  love.graphics.pop()
end

local Particle = {}
Particle.__index = Particle
function Particle:new()
  return setmetatable({ active = false }, self)
end
function Particle:init(x, y, color, speed, size)
  self.x, self.y = x, y
  local a = love.math.random() * math.pi * 2
  self.vx, self.vy = math.cos(a) * (speed or 5), math.sin(a) * (speed or 5)
  self.life = 1
  self.decay = rand(0.015, 0.04)
  self.color = color or { 1, 1, 1 }
  self.size = size or rand(3, 8)
  self.rotation = love.math.random() * math.pi * 2
  self.rotationSpeed = rand(-0.2, 0.2)
  self.active = true
end
function Particle:update()
  self.x = self.x + self.vx
  self.y = self.y + self.vy
  self.vx = self.vx * 0.98
  self.vy = self.vy * 0.98
  self.rotation = self.rotation + self.rotationSpeed
  self.life = self.life - self.decay
  if self.life <= 0 then self.active = false end
end
function Particle:draw()
  local forwardBoost = math.max(0, -(player.vy or 0)) / PLAYER_MAX_SPEED_UP
  local brightScale = 1.25 + forwardBoost * 1.35
  local blurScale = 1.1 + forwardBoost * 2.0
  local sizeScale = 1.15 + forwardBoost * 0.85
  local streakScale = 1 + forwardBoost * 2.2
  local alphaBoost = 0.2 + forwardBoost * 0.25

  love.graphics.push()
  love.graphics.translate(self.x, self.y)
  love.graphics.rotate(self.rotation)
  love.graphics.setBlendMode("add")
  love.graphics.setColor(self.color[1], self.color[2], self.color[3], math.min(1, self.life * brightScale + alphaBoost))
  local half = (self.size * sizeScale) / 2
  love.graphics.scale(1, streakScale)
  love.graphics.circle("fill", 0, 0, half)
  love.graphics.setBlendMode("alpha")
  love.graphics.pop()
end

local FloatingText = {}
FloatingText.__index = FloatingText
function FloatingText:new()
  return setmetatable({ active = false }, self)
end
function FloatingText:init(x, y, text, color)
  self.x, self.y, self.text, self.color = x, y, text, color or { 1, 1, 1 }
  self.life = 1
  self.active = true
end
function FloatingText:update()
  self.y = self.y - 1
  self.life = self.life - 0.02
  if self.life <= 0 then self.active = false end
end
function FloatingText:draw()
  love.graphics.setColor(self.color[1], self.color[2], self.color[3], self.life)
  love.graphics.setFont(fonts.text)
  love.graphics.print(self.text, self.x, self.y)
  love.graphics.setColor(1, 1, 1, 1)
end

-- Background ----------------------------------------------------------
local CosmicBackground = {}
CosmicBackground.__index = CosmicBackground
function CosmicBackground:new()
  local bg = setmetatable({ stars = {}, vortexes = {}, planets = {}, forwardRatio = 0, starSpeedScale = 1, starThinScale = 1 }, self)
  bg:init()
  return bg
end
function CosmicBackground:init()
  self.stars, self.vortexes, self.planets = {}, {}, {}
  for _ = 1, 100 do
    table.insert(self.stars, { x = love.math.random() * width, y = love.math.random() * height, z = love.math.random() * width, size = love.math.random() * 2 })
  end
  for _ = 1, 3 do
    table.insert(self.vortexes, {
      x = love.math.random() * width,
      y = love.math.random() * height,
      angle = love.math.random() * math.pi * 2,
      speed = (love.math.random() - 0.5) * 0.02,
      color = { love.math.random(), 0.7, 0.5 },
      size = 200 + love.math.random() * 300,
    })
  end
  for _ = 1, 3 do
    table.insert(self.planets, {
      x = love.math.random() * width,
      y = love.math.random() * height,
      r = 30 + love.math.random() * 50,
      color = { love.math.random(), 0.6, 0.4 },
      vx = (love.math.random() - 0.5) * 0.5,
      vy = (love.math.random() - 0.5) * 0.5,
    })
  end
end
function CosmicBackground:update()
  local forwardSpeed = math.max(0, -(player.vy or 0))
  local backwardSpeed = math.max(0, player.vy or 0)
  self.forwardRatio = math.min(1, forwardSpeed / PLAYER_MAX_SPEED_UP)
  local backwardRatio = math.min(1, backwardSpeed / PLAYER_MAX_SPEED_DOWN)
  local baseScale = 0.35 + self.forwardRatio * 1.65
  self.starSpeedScale = math.max(0.12, baseScale * (1 - backwardRatio * 0.65))
  self.starThinScale = math.max(0.35, 1 / (1 + self.forwardRatio * 1.1))

  local speed = 8 * self.starSpeedScale
  for _, s in ipairs(self.stars) do
    local depthSpeed = speed * (1 + (width - s.z) / width * 2)
    s.y = s.y + depthSpeed
    if s.y > height + 50 then
      s.y = -50
      s.x = love.math.random() * width
      s.z = love.math.random() * width
    end
  end

  for _, v in ipairs(self.vortexes) do
    v.angle = v.angle + v.speed
    v.x = v.x - (player.x - width / 2) * 0.002
    v.y = v.y - (player.y - height / 2) * 0.002
  end

  for _, p in ipairs(self.planets) do
    p.x = p.x + p.vx
    p.y = p.y + p.vy
    if p.x < -100 then p.x = width + 100 elseif p.x > width + 100 then p.x = -100 end
    if p.y < -100 then p.y = height + 100 elseif p.y > height + 100 then p.y = -100 end
  end
end
function CosmicBackground:draw()
  love.graphics.setColor(0.02, 0, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, width, height)

  love.graphics.setBlendMode("add")
  for _, v in ipairs(self.vortexes) do
    local r, g, b = hslToRgb(v.color[1] * 360, v.color[2], v.color[3])
    for i = 3, 1, -1 do
      local alpha = 0.06 * i
      love.graphics.setColor(r, g, b, alpha)
      love.graphics.circle("fill", v.x, v.y, v.size * (i / 3))
    end
    love.graphics.push()
    love.graphics.translate(v.x, v.y)
    love.graphics.rotate(v.angle)
    love.graphics.setColor(r, g, b, 0.25)
    love.graphics.setLineWidth(3)
    for i = 1, 6 do
      love.graphics.rotate(math.pi / 3)
      love.graphics.line(0, 0, v.size, 0)
    end
    love.graphics.pop()
  end

  love.graphics.setColor(1, 1, 1, 0.25)
  for _, s in ipairs(self.stars) do
    local depthFactor = (width - s.z) / width
    local baseWidth = s.size * (0.3 + depthFactor * 0.5)
    local finalWidth = baseWidth * self.starThinScale
    local screenProgress = s.y / height
    local stretchFactor = 0.5 + screenProgress * 3
    local h = baseWidth * stretchFactor * 4 * (1 + self.forwardRatio * 0.3)
    if s.x > 0 and s.x < width and s.y > 0 and s.y < height then
      love.graphics.ellipse("fill", s.x, s.y, finalWidth, h)
    end
  end
  love.graphics.setBlendMode("alpha")

  for _, p in ipairs(self.planets) do
    local r, g, b = hslToRgb(p.color[1] * 360, p.color[2], p.color[3], 0.8)
    love.graphics.setColor(r, g, b, 1)
    love.graphics.setBlendMode("add")
    love.graphics.circle("fill", p.x, p.y, p.r)
    love.graphics.setBlendMode("alpha")
    love.graphics.setColor(0, 0, 0, 0.3)
    love.graphics.circle("fill", p.x - p.r * 0.3, p.y + p.r * 0.3, p.r * 0.8)
  end
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.setBlendMode("alpha")
end

-- Pools ---------------------------------------------------------------
local bulletPool = Pool:new(function() return Bullet:new() end, 500)
local enemyPool = Pool:new(function() return Enemy:new() end, 50)
local particlePool = Pool:new(function() return Particle:new() end, 200)
local powerupPool = Pool:new(function() return PowerUp:new() end, 20)
local textPool = Pool:new(function() return FloatingText:new() end, 20)

local cosmicBg = CosmicBackground:new()

-- Sound ---------------------------------------------------------------
local sounds = {}
local function makeTone(freq, duration, volume)
  local rate = 44100
  local samples = math.floor(duration * rate)
  local soundData = love.sound.newSoundData(samples, rate, 16, 1)
  for i = 0, samples - 1 do
    local t = i / rate
    local sample = math.sin(2 * math.pi * freq * t) * (1 - t / duration)
    soundData:setSample(i, sample * volume)
  end
  return love.audio.newSource(soundData, "static")
end

local function loadSounds()
  sounds.shoot = makeTone(400, 0.12, 0.2)
  sounds.bomb = makeTone(150, 1.0, 0.6)
  sounds.shieldBreak = makeTone(800, 0.3, 0.4)
  sounds.hit = makeTone(100, 0.25, 0.4)
  sounds.powerup = makeTone(600, 0.18, 0.3)
end

local function playSound(name)
  if gameState == "DEMO" then return end
  local s = sounds[name]
  if not s then return end
  s:stop()
  s:play()
end

-- Utility drawing -----------------------------------------------------
function drawGlowTriangle(cx, cy, size, r, g, b, alpha)
  alpha = alpha or 1
  love.graphics.setBlendMode("add")
  love.graphics.setColor(r, g, b, 0.6 * alpha)
  love.graphics.polygon("fill", cx, cy - size, cx + size * 0.6, cy + size, cx - size * 0.6, cy + size)
  love.graphics.setColor(r, g, b, 1 * alpha)
  love.graphics.polygon("line", cx, cy - size, cx + size * 0.6, cy + size, cx - size * 0.6, cy + size)
  love.graphics.setBlendMode("alpha")
end

-- Game functions ------------------------------------------------------
local function setPlayerStartPosition()
  local topLimit = hudTopHeight + PLAYFIELD_TOP_BUFFER + player.radius
  local targetBottomY = height - PLAYFIELD_BOTTOM_PADDING - PLAYER_START_BOTTOM_OFFSET
  player.x = width / 2
  player.y = math.max(topLimit, targetBottomY)
end

local function clampPlayerToPlayfield(dampenVelocity)
  local leftBound = PLAYFIELD_SIDE_PADDING
  local rightBound = width - PLAYFIELD_SIDE_PADDING
  local topBound = hudTopHeight + PLAYFIELD_TOP_BUFFER
  local bottomBound = height - PLAYFIELD_BOTTOM_PADDING
  if player.x < leftBound then player.x = leftBound; if dampenVelocity and player.vx < 0 then player.vx = 0 end end
  if player.x > rightBound then player.x = rightBound; if dampenVelocity and player.vx > 0 then player.vx = 0 end end
  if player.y < topBound then player.y = topBound; if dampenVelocity and player.vy < 0 then player.vy = 0 end end
  if player.y > bottomBound then player.y = bottomBound; if dampenVelocity and player.vy > 0 then player.vy = 0 end end
end

local function createExplosionLogic(x, y, color, count)
  for _ = 1, count do table.insert(particles, particlePool:get(x, y, color)) end
end

function spawnBullet(...)
  local b = bulletPool:get(...)
  table.insert(bullets, b)
  return b
end

function spawnEnemyEntity(type)
  local e = enemyPool:get(type)
  table.insert(enemies, e)
  return e
end

function spawnParticle(...)
  local p = particlePool:get(...)
  table.insert(particles, p)
  return p
end

function spawnPowerup(...)
  local p = powerupPool:get(...)
  table.insert(powerups, p)
  return p
end

function spawnText(...)
  local t = textPool:get(...)
  table.insert(texts, t)
  return t
end

local function triggerBombLogic()
  playSound("bomb")
  flashAlpha = 1
  for _, e in ipairs(enemies) do
    e.active = false
    createExplosionLogic(e.x, e.y, { 1, 1, 0 }, 20)
    createExplosionLogic(e.x, e.y, { 1, 1, 1 }, 8)
    createExplosionLogic(e.x, e.y, { 1, 0.5, 0 }, 12)
  end
  for _, b in ipairs(bullets) do
    if b.type == "enemy" then
      b.active = false
      createExplosionLogic(b.x, b.y, { 1, 1, 0 }, 2)
    end
  end
  score = score + 2000
  spawnText(width / 2, height / 2, "OMEGA BLAST", { 1, 1, 0 })
end

local function firePlayerWeapons()
  if gameState == "PLAYING" then playSound("shoot") end
  spawnBullet(player.x, player.y - 20, -math.pi / 2, 18, "player", "beam")
  if player.powerLevel >= 2 then
    spawnBullet(player.x - 15, player.y, -1.7, 15, "player", "normal")
    spawnBullet(player.x + 15, player.y, -1.4, 15, "player", "normal")
  end
  if player.powerLevel >= 3 and frameCount % 14 == 0 then
    spawnBullet(player.x, player.y - 20, -1.6, 10, "player", "blade")
    spawnBullet(player.x, player.y - 20, -1.5, 10, "player", "blade")
  end
  if player.powerLevel >= 4 and frameCount % 21 == 0 then
    spawnBullet(player.x - 20, player.y, math.pi, 12, "player", "homing")
    spawnBullet(player.x + 20, player.y, 0, 12, "player", "homing")
  end
  if player.powerLevel >= 5 and frameCount % 21 == 0 then
    spawnBullet(player.x, player.y - 10, -math.pi / 2, 12, "player", "wave")
  end
  if player.powerLevel >= 6 then
    spawnBullet(player.x - 10, player.y - 20, -math.pi / 2, 18, "player", "beam")
    spawnBullet(player.x + 10, player.y - 20, -math.pi / 2, 18, "player", "beam")
  end
end

local function hitPlayer()
  if gameState == "DEMO" then return end
  if player.hasShield then
    player.hasShield = false
    playSound("shieldBreak")
    createExplosionLogic(player.x, player.y, { 0, 0, 1 }, 20)
    player.iframes = 60
    spawnText(player.x, player.y - 50, "SHIELD DOWN", { 0, 0.5, 1 })
    return
  end
  player.lives = player.lives - 1
  player.iframes = 120
  playSound("hit")
  flashAlpha = math.max(flashAlpha, 0.6)
  createExplosionLogic(player.x, player.y, { 1, 0, 0 }, 25)
  if player.powerLevel > 1 then
    player.powerLevel = player.powerLevel - 1
    spawnPowerup(player.x, player.y, "weapon", true)
    spawnText(player.x, player.y - 50, "SYSTEM DMG", { 1, 0, 0 })
  end
  if player.lives <= 0 then
    gameState = "GAMEOVER"
  end
end

local function resetWorldState()
  for i = #bullets, 1, -1 do bulletPool:release(table.remove(bullets, i)) end
  for i = #enemies, 1, -1 do enemyPool:release(table.remove(enemies, i)) end
  for i = #particles, 1, -1 do particlePool:release(table.remove(particles, i)) end
  for i = #powerups, 1, -1 do powerupPool:release(table.remove(powerups, i)) end
  for i = #texts, 1, -1 do textPool:release(table.remove(texts, i)) end
  player.tail = {}
end

local function initGame()
  score = 0
  player.lives = PLAYER_MAX_LIVES
  player.powerLevel = 1
  player.iframes = 0
  player.hasShield = false
  player.vx, player.vy, player.tilt = 0, 0, 0
  setPlayerStartPosition()
  resetWorldState()
  gameState = "PLAYING"
  accumulator = 0
end

local function returnToMenu()
  score = 0
  player.lives = PLAYER_MAX_LIVES
  player.powerLevel = 1
  player.iframes = 0
  player.hasShield = false
  player.vx, player.vy, player.tilt = 0, 0, 0
  resetWorldState()
  setPlayerStartPosition()
  gameState = "DEMO"
end

local function pauseGame()
  if gameState ~= "PLAYING" then return end
  gameState = "PAUSED"
end

local function resumeGame()
  if gameState ~= "PAUSED" then return end
  gameState = "PLAYING"
end

local function spawnEnemyLogic()
  local chance = love.math.random()
  local type = "chaser"
  local effectiveScore = (gameState == "DEMO") and 5000 or score
  if gameState == "DEMO" and #enemies > 30 then return end
  if effectiveScore > 500 and chance > 0.6 then type = "spinner" end
  if effectiveScore > 1000 and chance > 0.8 then type = "dasher" end
  if effectiveScore > 2000 and chance > 0.85 then type = "snake" end
  if effectiveScore > 3000 and chance > 0.9 then type = "sniper" end
  spawnEnemyEntity(type)
end

local function updateDemoAI()
  local targetX = player.x
  local targetY = height * 0.85
  local avoidX, avoidY, threatCount = 0, 0, 0
  local detectionRadius = 150
  for _, b in ipairs(bullets) do
    if b.type == "enemy" and b.active then
      local d = dist(player.x, player.y, b.x, b.y)
      if d < detectionRadius then
        local angle = math.atan(player.y - b.y, player.x - b.x)
        local force = (detectionRadius - d) / detectionRadius
        avoidX = avoidX + math.cos(angle) * force * 20
        avoidY = avoidY + math.sin(angle) * force * 20
        threatCount = threatCount + 1
      end
    end
  end
  for _, e in ipairs(enemies) do
    if e.active then
      local d = dist(player.x, player.y, e.x, e.y)
      if d < detectionRadius + 20 then
        local angle = math.atan(player.y - e.y, player.x - e.x)
        local force = (detectionRadius - d) / detectionRadius
        avoidX = avoidX + math.cos(angle) * force * 15
        avoidY = avoidY + math.sin(angle) * force * 15
        threatCount = threatCount + 1
      end
    end
  end
  local attractX, attractY, foundPowerup = 0, 0, false
  for _, p in ipairs(powerups) do
    if p.active and not foundPowerup then
      local d = dist(player.x, player.y, p.x, p.y)
      if d < 300 then attractX, attractY, foundPowerup = p.x - player.x, p.y - player.y, true end
    end
  end
  if threatCount == 0 and not foundPowerup then
    targetX = width / 2 + math.sin(frameCount * 0.01) * 200
  end
  local moveX, moveY = 0, 0
  if threatCount > 0 then moveX, moveY = avoidX, avoidY
  elseif foundPowerup then moveX, moveY = attractX * 0.05, attractY * 0.05
  else moveX, moveY = (targetX - player.x) * 0.02, (targetY - player.y) * 0.02 end
  player.x = player.x + moveX
  player.y = player.y + moveY
  clampPlayerToPlayfield(false)
  if frameCount % 7 == 0 then firePlayerWeapons() end
  player.powerLevel = 6
end

local function cleanList(list, pool)
  for i = #list, 1, -1 do
    if not list[i].active then
      pool:release(table.remove(list, i))
    end
  end
end

local function updateGame()
  if gameState ~= "PLAYING" and gameState ~= "DEMO" then
    globalHue = globalHue + 1
    return
  end
  if gameState == "DEMO" then updateDemoAI() end
  cosmicBg:update()
  globalHue = globalHue + 2
  frameCount = frameCount + 1
  local spawnRate = math.max(20, 60 - math.floor(score / 300))
  if gameState == "DEMO" then spawnRate = 15 end
  if frameCount % spawnRate == 0 then spawnEnemyLogic() end
  if frameCount % 2 == 0 then table.insert(player.tail, { x = player.x, y = player.y + 15, life = 1 }) end
  for _, t in ipairs(player.tail) do t.life = t.life - 0.1 end
  for i = #player.tail, 1, -1 do if player.tail[i].life <= 0 then table.remove(player.tail, i) end end

  if gameState == "PLAYING" then
    local accelX, accelY = 0, 0
    if love.keyboard.isDown("up", "w") then accelY = accelY - PLAYER_ACCEL end
    if love.keyboard.isDown("down", "s") then accelY = accelY + PLAYER_ACCEL end
    if love.keyboard.isDown("left", "a") then accelX = accelX - PLAYER_ACCEL end
    if love.keyboard.isDown("right", "d") then accelX = accelX + PLAYER_ACCEL end
    if input.active then
      local dx = input.lastX - player.x
      local dy = input.lastY - player.y
      local distance = math.sqrt(dx * dx + dy * dy)
      if distance > 2 then
        local steer = math.min(PLAYER_ACCEL, distance * 0.02)
        accelX = accelX + (dx / distance) * steer
        accelY = accelY + (dy / distance) * steer
      end
    end
    if accelY < 0 then accelY = accelY * PLAYER_ACCEL_UP_BOOST end
    if accelY > 0 then accelY = accelY * PLAYER_ACCEL_DOWN_FACTOR end
    player.vx = player.vx + accelX
    player.vy = player.vy + accelY
    player.vx = player.vx * PLAYER_FRICTION
    player.vy = player.vy * PLAYER_FRICTION
    local maxSpeed = player.vy < 0 and PLAYER_MAX_SPEED_UP or (player.vy > 0 and PLAYER_MAX_SPEED_DOWN or PLAYER_MAX_SPEED)
    local speed = math.sqrt(player.vx * player.vx + player.vy * player.vy)
    if speed > maxSpeed then
      local s = maxSpeed / speed
      player.vx, player.vy = player.vx * s, player.vy * s
    end
    player.x = player.x + player.vx
    player.y = player.y + player.vy
    clampPlayerToPlayfield(true)
    player.tiltDir = 1
    local absVx = math.abs(player.vx)
    local targetTilt = player.tilt
    if absVx > PLAYER_TILT_DEADZONE then
      local tiltNorm = math.min(1, (absVx - PLAYER_TILT_DEADZONE) / (PLAYER_MAX_SPEED - PLAYER_TILT_DEADZONE))
      targetTilt = tiltNorm * PLAYER_TILT_MAX * sign(player.vx) * player.tiltDir
    else
      targetTilt = targetTilt * PLAYER_TILT_DAMP
    end
    player.tilt = player.tilt * (1 - PLAYER_TILT_BLEND) + targetTilt * PLAYER_TILT_BLEND
  end

  if gameState == "PLAYING" and frameCount % 7 == 0 then firePlayerWeapons() end
  if player.iframes > 0 then player.iframes = player.iframes - 1 end

  local lists = { bullets, enemies, particles, powerups, texts }
  for _, list in ipairs(lists) do
    for _, e in ipairs(list) do if e.update then e:update() end end
  end

  -- Collisions
  for _, b in ipairs(bullets) do
    if b.type == "player" then
      for _, e in ipairs(enemies) do
        local hit = dist(b.x, b.y, e.x, e.y) < (e.radius or 0) + b.radius + 5
        if e.type == "snake" then
          if dist(b.x, b.y, e.x, e.y) < (e.radius or 0) + b.radius then hit = true end
          for _, s in ipairs(e.segments) do if dist(b.x, b.y, s.x, s.y) < (e.radius or 0) + b.radius then hit = true end end
        end
        if hit then
          if b.subType ~= "blade" and b.subType ~= "wave" then b.active = false end
          e.hp = e.hp - ((b.subType == "blade" or b.subType == "wave") and 0.5 or 1)
          e.flashTimer = 8
          spawnParticle(b.x, b.y, { 1, 1, 1 })
          if e.hp <= 0 and e.active then
            e.active = false
            if gameState == "PLAYING" then score = score + 100 end
            local hue = globalHue % 360
            createExplosionLogic(e.x, e.y, { hslToRgb(hue, 1, 0.5) }, 25)
            createExplosionLogic(e.x, e.y, { 1, 1, 1 }, 10)
            createExplosionLogic(e.x, e.y, { hslToRgb((hue + 60) % 360, 1, 0.6) }, 15)
            if love.math.random() < 0.08 then spawnPowerup(e.x, e.y) end
          end
        end
      end
    else
      if player.iframes <= 0 and dist(b.x, b.y, player.x, player.y) < player.radius + 5 then b.active = false; hitPlayer() end
    end
  end
  for _, e in ipairs(enemies) do
    local hit = dist(e.x, e.y, player.x, player.y) < (e.radius or 0) + player.radius
    if e.type == "snake" then for _, s in ipairs(e.segments) do if dist(s.x, s.y, player.x, player.y) < (e.radius or 0) + player.radius then hit = true end end end
    if player.iframes <= 0 and hit then hitPlayer() end
  end
  for _, p in ipairs(powerups) do
    if dist(p.x, p.y, player.x, player.y) < p.radius + 20 then
      p.active = false
      playSound("powerup")
      if p.type == "weapon" then
        if player.powerLevel < player.maxPower then player.powerLevel = player.powerLevel + 1; spawnText(player.x, player.y - 40, "UPGRADE", { 0, 1, 1 })
        else score = score + (gameState == "PLAYING" and 1000 or 0); spawnText(player.x, player.y - 40, "+1000", { 1, 1, 1 }) end
      elseif p.type == "bomb" then triggerBombLogic()
      elseif p.type == "shield" then player.hasShield = true; spawnText(player.x, player.y - 40, "SHIELD UP", { 0, 0.4, 1 })
      elseif p.type == "life" then
        local prevLives = player.lives
        player.lives = math.min(PLAYER_MAX_LIVES, player.lives + 1)
        if player.lives > prevLives then spawnText(player.x, player.y - 40, "EXTEND", { 1, 0, 0 }) end
      end
    end
  end

  cleanList(bullets, bulletPool)
  cleanList(enemies, enemyPool)
  cleanList(particles, particlePool)
  cleanList(powerups, powerupPool)
  cleanList(texts, textPool)
end

-- UI -----------------------------------------------------------------
local function drawScore()
  local padded = string.format("%0" .. SCORE_DIGITS .. "d", score)
  local firstActive = padded:find("[1-9]") or #padded
  love.graphics.setFont(fonts.score)
  for i = 1, #padded do
    local digit = padded:sub(i, i)
    local active = i >= firstActive
    local x = 20 + (i - 1) * (fonts.score:getWidth("0") * 0.75)
    local y = 14
    if not active then
      love.graphics.setColor(1, 1, 1, 0.25)
      love.graphics.print(digit, x, y)
    else
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.print(digit, x, y)
    end
  end
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawLives()
  love.graphics.push()
  love.graphics.translate(width - 200, 14)
  for i = 1, player.lives do
    local offset = (i - 1) * 28
    love.graphics.setColor(1, 0, 0, 1)
    love.graphics.polygon("fill", offset, 0, offset + 20, 0, offset + 24, 12, offset + 24, 28, offset + 20, 40, offset + 0, 40, offset - 4, 28, offset - 4, 12)
    love.graphics.setColor(1, 1, 1, 0.9)
    love.graphics.polygon("line", offset, 0, offset + 20, 0, offset + 24, 12, offset + 24, 28, offset + 20, 40, offset + 0, 40, offset - 4, 28, offset - 4, 12)
  end
  love.graphics.pop()
end

local function drawPowerBar()
  local segCount = 5
  local barW, barH = 200, 14
  local startX = width - 240
  local startY = hudTopHeight - barH - 10
  love.graphics.setColor(0, 1, 1, 0.25)
  love.graphics.rectangle("fill", startX, startY, barW, barH)
  love.graphics.setColor(1, 1, 1, 0.6)
  love.graphics.rectangle("line", startX, startY, barW, barH)
  local segW = barW / segCount - 4
  for i = 1, segCount do
    local filled = i < player.powerLevel
    local maxed = player.powerLevel == player.maxPower and filled
    local x = startX + 2 + (i - 1) * (segW + 4)
    if maxed then love.graphics.setColor(1, 0, 1, 0.8) elseif filled then love.graphics.setColor(0, 1, 1, 0.8) else love.graphics.setColor(1, 1, 1, 0.15) end
    love.graphics.rectangle("fill", x, startY + 2, segW, barH - 4)
  end
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawHUD()
  love.graphics.setColor(0, 0, 0, 0.65)
  love.graphics.rectangle("fill", 0, 0, width, hudTopHeight)
  love.graphics.setColor(0, 1, 1, 0.2)
  love.graphics.rectangle("line", 0, 0, width, hudTopHeight)
  drawScore()
  drawLives()
  drawPowerBar()
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawButton(btn)
  love.graphics.setColor(0, 0, 0, 0.6)
  love.graphics.rectangle("fill", btn.x, btn.y, btn.w, btn.h)
  love.graphics.setColor(0, 1, 1, 0.8)
  love.graphics.rectangle("line", btn.x, btn.y, btn.w, btn.h)
  love.graphics.setFont(fonts.button)
  love.graphics.printf(btn.label, btn.x, btn.y + btn.h / 2 - fonts.button:getHeight() / 2, btn.w, "center")
  love.graphics.setColor(1, 1, 1, 1)
end

local function refreshButtons(state)
  activeButtons = {}
  local buttons = {}
  if state == "DEMO" then
    buttons = { { label = "ENGAGE", action = initGame } }
  elseif state == "PAUSED" then
    buttons = { { label = "RESUME", action = resumeGame }, { label = "RESTART", action = initGame }, { label = "QUIT TO MENU", action = returnToMenu } }
  elseif state == "GAMEOVER" then
    buttons = { { label = "REBOOT", action = initGame } }
  end
  local btnW, btnH = 280, 64
  for i, b in ipairs(buttons) do
    b.w, b.h = btnW, btnH
    b.x = width / 2 - btnW / 2
    b.y = height * 0.6 + (i - 1) * (btnH + 16)
    table.insert(activeButtons, b)
  end
end

local function drawOverlays()
  if gameState == "DEMO" or gameState == "PAUSED" or gameState == "GAMEOVER" then
    love.graphics.setColor(0, 0, 0, 0.4)
    love.graphics.rectangle("fill", 0, 0, width, height)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setFont(fonts.title)
    love.graphics.printf("NEON", 0, height * 0.2, width, "center")
    love.graphics.setFont(fonts.subtitle)
    love.graphics.printf("OVERDRIVE", 0, height * 0.2 + fonts.title:getHeight() - 10, width, "center")
    refreshButtons(gameState)
    for _, b in ipairs(activeButtons) do drawButton(b) end
    if gameState == "GAMEOVER" then
      love.graphics.setFont(fonts.subtitle)
      love.graphics.printf("CRITICAL FAIL", 0, height * 0.45, width, "center")
      love.graphics.printf(string.format("FINAL SCORE: %d", score), 0, height * 0.48 + fonts.subtitle:getHeight(), width, "center")
    end
  end
end

-- Draw routines -------------------------------------------------------
local function drawPlayer()
  if (gameState == "PLAYING" or gameState == "DEMO" or gameState == "PAUSED") and (player.iframes == 0 or math.floor(frameCount / 4) % 2 == 0) then
    love.graphics.push()
    love.graphics.translate(player.x, player.y)
    for _, t in ipairs(player.tail) do
      love.graphics.setColor(0, 1, 1, t.life * 0.6)
      love.graphics.circle("fill", t.x - player.x, t.y - player.y, 6 * t.life)
    end
    love.graphics.setColor(1, 1, 1, 1)
    if player.hasShield then
      love.graphics.setColor(0, 0.7, 1, 0.6)
      love.graphics.setLineWidth(2)
      love.graphics.circle("line", 0, 0, 35)
      love.graphics.setColor(0, 0.7, 1, 0.2)
      love.graphics.circle("fill", 0, 0, 30)
    end
    love.graphics.rotate(player.tilt)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("add")
    love.graphics.polygon("fill", 0, -25, 8, 5, 16, 15, 8, 15, 6, 20, -6, 20, -8, 15, -16, 15, -8, 5)
    love.graphics.setBlendMode("alpha")
    love.graphics.setColor(0, 0.2, 0.3, 1)
    love.graphics.polygon("fill", 0, -10, 4, 5, 0, 8, -4, 5)
    love.graphics.setBlendMode("add")
    love.graphics.setColor(0, 1, 1, 1)
    love.graphics.rectangle("fill", -5, 20, 3, 5)
    love.graphics.rectangle("fill", 2, 20, 3, 5)
    love.graphics.setBlendMode("alpha")
    love.graphics.pop()
  end
end

local function drawGrid()
  love.graphics.setColor(hslToRgb(globalHue % 360, 0.8, 0.4, 0.15))
  love.graphics.setLineWidth(1)
  local gs = 80
  for x = 0, width, gs do love.graphics.line(x, 0, x, height) end
  for y = 0, height, gs do love.graphics.line(0, y, width, y) end
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawScanlines()
  love.graphics.setColor(0, 0, 0, 0.15)
  for y = 0, height, 4 do love.graphics.rectangle("fill", 0, y, width, 1) end
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawVignette()
  for i = 0, 6 do
    local inset = i * 12
    love.graphics.setColor(0, 0, 0, 0.08)
    love.graphics.rectangle("line", 0 + inset, 0 + inset, width - inset * 2, height - inset * 2)
  end
  love.graphics.setColor(1, 1, 1, 1)
end

local function drawGlitchOverlay()
  if frameCount % 4 == 0 then
    love.graphics.setBlendMode("add")
    local r, g, b = hslToRgb((globalHue + 180) % 360, 1, 0.5, 0.05)
    love.graphics.setColor(r, g, b, 0.08)
    love.graphics.rectangle("fill", 0, 0, width, height)
    love.graphics.setBlendMode("alpha")
  end
end

function love.draw()
  love.graphics.setBlendMode("alpha")
  cosmicBg:draw()
  drawGrid()

  love.graphics.setColor(1, 1, 1, 1)
  for _, e in ipairs(powerups) do e:draw() end
  for _, e in ipairs(particles) do e:draw() end
  for _, e in ipairs(bullets) do e:draw() end
  for _, e in ipairs(enemies) do e:draw() end
  for _, e in ipairs(texts) do e:draw() end
  drawPlayer()

  if gameState ~= "DEMO" then drawHUD() end
  drawGlitchOverlay()
  drawScanlines()
  drawVignette()

  if flashAlpha > 0 then
    love.graphics.setColor(1, 1, 1, flashAlpha)
    love.graphics.rectangle("fill", 0, 0, width, height)
    love.graphics.setColor(1, 1, 1, 1)
  end
  drawOverlays()
end

-- Input ---------------------------------------------------------------
function love.keypressed(key)
  if key == "return" or key == "space" then
    if gameState == "DEMO" or gameState == "GAMEOVER" then initGame() end
  elseif key == "escape" or key == "p" then
    if gameState == "PLAYING" then pauseGame() elseif gameState == "PAUSED" then resumeGame() end
  elseif key == "r" then
    if gameState == "PLAYING" or gameState == "GAMEOVER" then initGame() end
  end
end

function love.mousepressed(x, y, button)
  if button ~= 1 then return end
  input.active = true
  input.lastX, input.lastY = x, y
  if gameState == "DEMO" or gameState == "PAUSED" or gameState == "GAMEOVER" then
    for _, b in ipairs(activeButtons) do
      if x >= b.x and x <= b.x + b.w and y >= b.y and y <= b.y + b.h then b.action() end
    end
  end
end

function love.mousemoved(x, y)
  input.lastX, input.lastY = x, y
end

function love.mousereleased()
  input.active = false
end

function love.resize(w, h)
  width, height = w, h
  hudTopHeight = 80
  setPlayerStartPosition()
  cosmicBg:init()
end

-- Main loop -----------------------------------------------------------
function love.update(dt)
  if flashAlpha > 0 then flashAlpha = math.max(0, flashAlpha - dt * flashDecay) end
  accumulator = accumulator + dt
  while accumulator >= TIME_STEP do
    updateGame()
    accumulator = accumulator - TIME_STEP
  end
end

function love.load()
  love.window.setTitle("NEON GLITCH HELL: OVERDRIVE")
  love.window.setMode(width, height, { resizable = true, minwidth = 960, minheight = 540, highdpi = true, msaa = 4 })
  width, height = love.graphics.getDimensions()
  fonts.hud = love.graphics.newFont(18)
  fonts.score = love.graphics.newFont(22)
  fonts.text = love.graphics.newFont(18)
  fonts.button = love.graphics.newFont(22)
  fonts.title = love.graphics.newFont(70)
  fonts.subtitle = love.graphics.newFont(28)
  loadSounds()
  setPlayerStartPosition()
  resetWorldState()
  gameState = "DEMO"
end
