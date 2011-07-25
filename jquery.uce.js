/*!
 * jQuery UNIX Console Emulator Plugin
 * Copyright 2011, Johannes Donath
 * Licensed under the GNU Lesser Public License
*/

(function(jQuery){
	var terminal = {
			/**
			 * Contains settings for our plugin
			 */
			settings					:		{
				'callbackUrl'						:	'terminal.php',
				'callbackParameter'					:	'command',
				'backgroundColor'					:	'#000000',
				'foregroundColor'					:	'#008000',
				'consoleContentID'					:	'consoleContent',
				'consoleInputLineID'				:	'consoleInputLine',
				'consoleInputLineWrapperID'			:	'consoleInputLineWrapper',
				'consoleCursorID'					:	'consoleCursor',
				'ps1ContainerID'					:	'consolePS1',
				'cursorBlinkRate'					:	500,
				'generalErrorMessage'				:	'<span style="color: #ff3333"><b>An error occoured! Please try again later!</b></span><br />',
				'cursorBlinkTimeout'				:	500,
				'bellDuration'						:	300,
				'bellColor'							:	'#FFFFFF',
				'motd'								:	'',
				'disableDefaultBindings'			:	false,
				'typeInSpeed'						:	50,
				'disableTypeInSubmit'				:	false
			},
			
			/**
			 * Contains variables set by user or application
			 */
			variables					:		{
				'PS1'								:	'<span style="color: #ff3333">Terminal</span>:~#&nbsp;'
			},
			
			mainElement					:		null,
	
			/**
			 * Contains the element where we'll store our command output
			 */
			consoleContent				:		null,
			
			/**
			 * Contains the element wich contains the current command line input (Without PS1)
			 */
			consoleInputLine			:		null,
			
			/**
			 * Contains the cursor element
			 */
			consoleCursor				:		null,
			
			/**
			 * If this is set to true the cursor will NOT blink
			 */
			disableCursorBlink			:		false,
			
			/**
			 * Contains the position where cursor is currently
			 */
			cursorPosition				:		0,
			
			/**
			 * Contains the current visibility state of cursor
			 */
			cursorBlinkState			:		false,
			
			/**
			 * Contains the input buffer
			 */
			consoleInputBuffer			:		'',
			
			/**
			 * Contains a history of commands
			 */
			commandHistory				:		[],
			
			/**
			 * Contains false if the command isn't ready yet
			 */
			consoleIsReady				:		true,
			
			/**
			 * Contains the unix timestamp of last cursor position change
			 */
			lastCursorPositionChange	:		0,
			
			/**
			 * Contains the interval handle for type ins
			 */
			typeInInterval				:		null,
			
			/**
			 * Contains the current type in index
			 */
			typeInIndex					:		0,
			
			/**
			 * Special key handling ...
			 */
			sticky						: {
				/**
				 * Contains special keys and their current states
				 */
				keys		:		{
					ctrl		:		false,
					alt			:		false
				},

				/**
				 * Sets a new state
				 */
				set			:		function(key, state) {
					this.keys[key] = state;
				},

				/**
				 * Toggles a state
				 */
				toggle		:		function(key) {
					this.set(key, !this.keys[key]);
				},

				/**
				 * Resets the state
				 */
				reset		:		function(key) {
						this.set(key, false);
				},

				/**
				 * Resets all states
				 */
				resetAll	:		function(key) {
					$.each(this.keys, $.proxy(function(name, value) {
						this.reset(name);
					}, this));
				}
			},
			
			/**
			 * Initial method
			 */
			init						:		function(options) {
				// parse settings
				$.extend(terminal.settings, options);
				
				// clear container
				this.html('');
				
				// save container
				terminal.mainElement = this;
				
				// update css
				this.css('background-color',	terminal.settings.backgroundColor)
					.css('color',				terminal.settings.foregroundColor)
					.css('overflow',			'hidden');
				
				// create elements
				this.html(	'<span id="' + terminal.settings.consoleContentID + '"></span> \
							 <span id="' + terminal.settings.consoleInputLineWrapperID + '">\
									<span id="' + terminal.settings.ps1ContainerID + '">' + terminal.variables.PS1 + '</span> \
									<span id="' + terminal.settings.consoleInputLineID + '"></span>\
							 </span>');
				
				// get elements
				terminal.consoleContent = $('#' + terminal.settings.consoleContentID);
				terminal.consoleInputLine = $('#' + terminal.settings.consoleInputLineID);
				
				// print motd
				terminal.consoleContent.append(terminal.settings.motd);
				
				// rebuild input line
				terminal.rebuildInputLine.call(this);
				
				// start cursor blink
				terminal.cursorBlink.call(this);
				
				// add binds
				if (!terminal.settings.disableDefaultBindings) terminal.initBinds.call(this);
				
				// add events
				terminal.initEvents.call(this);
			},
			
			/**
			 * Binds all events
			 */
			initBinds					:		function() {
				// kill operas defaults
				document.onkeydown = document.onkeypress = function(e) { return $.hotkeys.specialKeys[e.keyCode] != 'backspace'; }; 
				
				// add listener
				$(document).keypress(
					$.proxy(function(e) {
						if (this.isReady()) {
							if (e.which >= 32 && e.which <= 126) {
								var character = String.fromCharCode(e.which);
								var letter = character.toLowerCase();
							} else {
									return;
							}
							
							if ($.browser.opera && !(/[\w\s]/.test(character))) return;
							
							// add character
							if (character) {
									this.appendCharacter(character);
									e.preventDefault();
							}
						}
					}, terminal)
				).bind('keydown', 'return',
					$.proxy(function(e) {
						if (this.isReady()) this.sendCommand();
						e.preventDefault();
					}, terminal)
				).bind('keydown', 'backspace',
					$.proxy(function(e) {
						if (this.isReady()) this.removeCharacter();
						e.preventDefault();
					}, terminal)
				).bind('keydown', 'tab',
					$.proxy(function(e) {
						e.preventDefault();
					}, terminal)
				).bind('keydown', 'left',
					$.proxy(function(e) {
						this.changeCursorPosition(this.cursorPosition - 1);
						e.preventDefault();
					}, terminal)
				).bind('keydown', 'right',
					$.proxy(function(e) {
						this.changeCursorPosition(this.cursorPosition + 1);
						e.preventDefault;
					}, terminal)
				).keyup(
					$.proxy(function(e) {
						var keyName = $.hotkeys.specialKeys[e.which];
						
						if (keyName in {'ctrl':true, 'alt':true}) {
							this.sticky.toggle(keyName);
						} else if (!(keyName in {'left':true, 'right':true, 'up':true, 'down':true})) {
							this.sticky.resetAll();
						}
					}, terminal)
				); 
			},
			
			/**
			 * Registers callback methods for all needed events
			 */
			initEvents					:		function() {
				$(window).resize(
					$.proxy(function(e) {
						this.mainElement.scrollTop(this.mainElement.attr('scrollHeight'));
					}, terminal)
				);
			},
			
			/**
			 * Rebuilds the whole input line
			 */
			rebuildInputLine			:		function() {
				var consoleContent = terminal.consoleInputBuffer;
				var firstConsoleContentPart = consoleContent.substr(0, terminal.cursorPosition);
				var secondConsoleContentPart = (consoleContent.length > terminal.cursorPosition ? consoleContent.substr(terminal.cursorPosition + 1) : '');
				var consoleContent = firstConsoleContentPart + '<span id="' + terminal.settings.consoleCursorID + '" style="background-color: ' + terminal.settings.foregroundColor + '; color: ' + terminal.settings.backgroundColor + ';">' + (terminal.consoleInputBuffer.charAt(terminal.cursorPosition) != '' ? terminal.consoleInputBuffer.charAt(terminal.cursorPosition) : '&nbsp;')  + '</span>' + secondConsoleContentPart;
				
				terminal.consoleInputLine.html(consoleContent);
				
				terminal.consoleCursor = $('#' + terminal.settings.consoleCursorID);
			},
			
			/**
			 * Appends a new character to input
			 * @param		string			character
			 */
			appendCharacter				:		function(character) {
				var consoleContent = terminal.consoleInputBuffer;
				var firstConsoleContentPart = consoleContent.substr(0, terminal.cursorPosition);
				var secondConsoleContentPart = (consoleContent.length > terminal.cursorPosition ? consoleContent.substr(terminal.cursorPosition) : '');
				
				terminal.consoleInputBuffer = firstConsoleContentPart + character + secondConsoleContentPart;
				
				terminal.changeCursorPosition(terminal.cursorPosition + 1);
			},
			
			/**
			 * Removes a character from input
			 */
			removeCharacter				:		function() {
				var consoleContent = terminal.consoleInputBuffer;
				var firstConsoleContentPart = consoleContent.substr(0, terminal.cursorPosition);
				var secondConsoleContentPart = (consoleContent.length > terminal.cursorPosition ? consoleContent.substr(terminal.cursorPosition) : '');
				
				firstConsoleContentPart = firstConsoleContentPart.substr(0, (firstConsoleContentPart.length - 1));
				terminal.consoleInputBuffer = firstConsoleContentPart + secondConsoleContentPart;
				
				terminal.changeCursorPosition(terminal.cursorPosition - 1);
			},
			
			/**
			 * Sends the command
			 */
			sendCommand					:		function() {
				// catch empty commands
				if (terminal.consoleInputBuffer.match(/^(\s+)$/) || terminal.consoleInputBuffer == '') {
					this.consoleInputBuffer = '';
					this.cursorPosition = 0;
					this.consoleContent.append(this.buildInputLogLine());
					this.rebuildInputLine();
					return;
				}
				
				terminal.consoleIsReady = false;
				
				terminal.commandHistory.push(terminal.consoleInputBuffer);
				
				$.ajax({
					url			:		terminal.settings.callbackUrl,
					type		:		'post',
					data		:		terminal.settings.callbackParameter + '=' + escape(terminal.consoleInputBuffer) + '&' + $.param(terminal.variables),
					beforeSend	:		$.proxy(function() {
						this.consoleContent.append(this.buildInputLogLine());
						this.consoleInputBuffer = '';
						this.cursorPosition = 0;
						this.consoleInputLine.html('');
					}, terminal),
					success		:		$.proxy(function(data) {
						this.consoleContent.append(data);
						this.rebuildInputLine();
						terminal.consoleIsReady = true;
					}, terminal),
					error		:		$.proxy(function() {
						this.consoleContent.append(this.settings.generalErrorMessage);
						this.rebuildInputLine();
						terminal.consoleIsReady = true;
					}, terminal)
				});
			},
			
			/**
			 * Types in a text
			 * @param		String			text
			 * @param		callback		callback
			 */
			typeIn						:		function(text, callback) {
				terminal.typeInInterval = window.setInterval($.proxy(function typeCharacter() {
					if (this.typeInIndex < text.length) {
						this.appendCharacter(text.charAt(this.typeInIndex));
						this.typeInIndex++;
					} else {
						this.typeInIndex = 0;
						clearInterval(this.typeInInterval);
						
						if (!this.settings.disableTypeInSubmit)
							this.sendCommand();
						else {
							this.consoleContent.append(this.buildInputLogLine());
							this.consoleInputBuffer = '';
							this.cursorPosition = 0;
							this.rebuildInputLine();
							
							callback();
						}
					}
				}, terminal), terminal.settings.typeInSpeed);
			},
			
			/**
			 * Builds the input line for logging in terminal content
			 * @returns {String}
			 */
			buildInputLogLine			:		function() {
				return '<span class="terminalMessage"><span class="terminalMessagePS1">' + terminal.variables.PS1 + '</span><span class="terminalMessageContent">' + terminal.consoleInputBuffer + '<br /></span></span>';
			},
			
			/**
			 * Returns true if the console is ready
			 * @returns		boolean
			 */
			isReady						:		function() {
				return terminal.consoleIsReady;
			},
			
			/**
			 * Changes the cursor position to new value
			 * @param		integer		newPosition
			 */
			changeCursorPosition		:		function(newPosition) {
				terminal.lastCursorPositionChange = (new Date).getTime();
				
				if ((terminal.cursorPosition == 0 && newPosition <= 0) || newPosition >= (terminal.consoleInputBuffer.length + 1)) {
					terminal.bell();
					return;
				}
				
				terminal.cursorPosition = newPosition;
				terminal.rebuildInputLine();
			},
			
			/**
			 * Emulates a UNIX like bell (Without sound)
			 */
			bell						:		function() {
				// set background color
				terminal.mainElement.css('background-color', terminal.settings.bellColor);
				
				// update cursor (for better look)
				terminal.consoleCursor.css('background-color', terminal.settings.backgroundColor)
									  .css('color', terminal.settings.foregroundColor);
				terminal.cursorBlinkState = false;
				
				// reset all
				setTimeout($.proxy(function() {
					this.mainElement.css('background-color', this.settings.backgroundColor);
				}, terminal), terminal.settings.bellDuration);
			},
			
			/**
			 * Toggles the cursor
			 */
			cursorBlink					:		function() {
				if (!terminal.isCursorBlinkDisabled() || !terminal.cursorBlinkState) {
					terminal.consoleCursor.css('background-color', (!terminal.cursorBlinkState ? terminal.settings.foregroundColor : terminal.settings.backgroundColor));
					terminal.consoleCursor.css('color', (terminal.cursorBlinkState ? terminal.settings.foregroundColor : terminal.settings.backgroundColor));
					terminal.cursorBlinkState = !terminal.cursorBlinkState;
				}
				
				setTimeout(terminal.cursorBlink, terminal.settings.cursorBlinkRate);
			},
			
			/**
			 * Returns true if the cursor should not blink
			 * @returns		boolean
			 */
			isCursorBlinkDisabled		:		function() {
				if (terminal.lastCursorPositionChange + terminal.settings.cursorBlinkTimeout > (new Date()).getTime()) return true;
				
				return terminal.disableCursorBlink;
			},
			
			/**
			 * Sets the value of a variable
			 * @param		String				variable
			 * @param		String				value
			 */
			setVariable					:		function(variable, value) {
				terminal.variables[variable] = value;
			}
	};
	
	/**
	 * Terminal namespace
	 */
	$.fn.terminal = function(method) {
		if (terminal[method])
			// fire methods
			return terminal[method].apply(this, Array.prototype.slice.call( arguments, 1 ));
		
		else if (typeof method === 'object' || ! method) {
			// fire init method
			return terminal.init.apply(this, arguments);
		}
	};
})( jQuery );