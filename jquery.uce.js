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
			settings			:		{
				'callbackUrl'						:	'terminal.php',
				'callbackParameter'					:	'command',
				'backgroundColor'					:	'#000000',
				'foregroundColor'					:	'#008000',
				'consoleContentID'					:	'consoleContent',
				'consoleInputLineID'				:	'consoleInputLine',
				'consoleInputLineWrapperID'			:	'consoleInputLineWrapper',
				'consoleCursorID'					:	'consoleCursor',
				'ps1ContainerID'					:	'consolePS1',
				'PS1'								:	'<span style="color: #b00000">Terminal</span>&nbsp;#&nbsp;'
			},
	
			/**
			 * Contains the element where we'll store our command output
			 */
			consoleContent		:		null,
			
			/**
			 * Contains the element wich contains the current command line input (Without PS1)
			 */
			consoleInputLine	:		null,
			
			/**
			 * Contains the cursor element
			 */
			consoleCursor		:		null,
			
			cursorPosition		:		0,
			
			/**
			 * Contains the input buffer
			 */
			consoleInputBuffer	:		[],
			
			/**
			 * Contains a history of commands
			 */
			commandHistory		:		[],	
			
			/**
			 * Special key handling ...
			 */
			sticky: {
				/**
				 * Contains special keys and their current states
				 */
				keys		:		{
					ctrl		:		false,
					alt			:		false,
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
			init				:		function(options) {
				// parse settings
				$.extend(terminal.settings, options);
				
				// clear container
				this.html('');
				
				// create elements
				this.html('<span id="' + terminal.settings.consoleContentID + '"></span><span id="' + terminal.settings.consoleInputLineWrapperID + '">')
			}
	}
	
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
	}
})( jQuery );