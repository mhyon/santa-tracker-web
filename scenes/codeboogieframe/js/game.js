/*
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
'use strict';

goog.provide('app.Game');

goog.require('Klang');
goog.require('app.Blockly');
goog.require('app.Constants');
goog.require('app.Result');
goog.require('app.Scene');
goog.require('app.SceneTutorial');
goog.require('app.Levels');
goog.require('app.freestyleLevel');
goog.require('app.monkeypatches');
goog.require('app.shared.FrameRPC');
goog.require('app.shared.utils');

/**
 * @enum {string}
 */
app.GameMode = {
  TEACHER: 'teacher',
  FREESTYLE: 'freestyle',
  CUSTOM: 'custom'
};

/**
 * Main game class
 * @param {!Element} elem An DOM element which wraps the game.
 * @constructor
 * @export
 */
app.Game = function(elem) {
  this.blockly = new app.Blockly(elem.querySelector('.blockly'), this);
  this.elem = elem;
  this.levelNumber = null;
  this.level = null;
  this.isPlaying = false;
  this.successResult = new app.Result(elem.querySelector('.result--success'), this);
  this.failureResult = new app.Result(elem.querySelector('.result--failure'), this);
  this.scene = new app.Scene(elem.querySelector('.scene'), this, this.blockly);
  this.tutorial_ = new app.SceneTutorial(elem.querySelector('.tutorial'));

  this.iframeChannel = new app.shared.FrameRPC(window.parent, {
    restart: this.restart.bind(this),
    beat: this.scene.player.onBeat.bind(this.scene.player)
  });

  Klang.setEventListener(this.iframeChannel.call.bind(this.iframeChannel, 'triggerSound'));

  this.scene.player.listen('start', () => this.iframeChannel.call('setVariant', 1));
  this.scene.player.listen('finish', () => this.iframeChannel.call('setVariant', 0));

  window.addEventListener('blur', this.onBlur.bind(this));
  window.addEventListener('focus', this.onFocus.bind(this));
};

/**
 * Clean up game instance.
 * @private
 */
app.Game.prototype.dispose_ = function() {
  this.tutorial_.dispose();
  this.scene.dispose();
};

/**
 * Transition to next level.
 */
app.Game.prototype.bumpLevel = function() {
  // Next level
  this.levelNumber++;

  this.level = this.levels[this.levelNumber];
  if (!this.level) {
    this.iframeChannel.call('gameover');
    return;
  }

  this.iframeChannel.call('setLevel', this.levelNumber, this.level.track, this.level.bpm);

  this.elem.className = this.level.className();

  this.blockly.setLevel(this.level);
  this.scene.setLevel(this.level);
  this.scene.toggleVisibility(true);
};

app.Game.prototype.onBlur = function() {
  this.iframeChannel.call('iframeFocusChange', 'blur');
};

app.Game.prototype.onFocus = function() {
  this.iframeChannel.call('iframeFocusChange', 'focus');
};

/**
 * Resets state of the current level.
 */
app.Game.prototype.restartLevel = function() {
  this.scene.restartLevel();
};

/**
 * Starts the game.
 */
app.Game.prototype.start = function() {
  this.restart();
};

/**
 * Resets all game entities and restarts the game. Can be called at any time.
 *
 * @param {app.GameMode} mode to play.
 * @param {string} customLevel serialized string.
 */
app.Game.prototype.restart = function(mode, customLevel) {
  if (mode === app.GameMode.FREESTYLE) {
    let stage = customLevel
    this.levels = app.Levels.createFreestyleLevel(stage);
  } else if (mode === app.GameMode.CUSTOM) {
    let level = app.DanceLevel.deserialize(customLevel);
    if (level) {
      this.levels = [level];
    }
  } else {
    this.levels = app.Levels.getDanceClasses();
  }

  var match = location.search.match(/[?&]level=(\d+)/) || [];
  var levelNumber = (+match[1] - 1 || 0) - 1;
  this.levelNumber = levelNumber;

  this.scene.reset();
  this.bumpLevel();
};
