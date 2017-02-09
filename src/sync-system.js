/**
* Connect to a remote Firebase server, and facilitate synchronization. These
* options correspond exactly with the configuration options for
* [altspace.utilities.sync.connect]{@link http://altspacevr.github.io/AltspaceSDK/doc/module-altspace_utilities_sync.html#.connect}.
* This component must be present on `a-scene` for any other sync components to work.
* @memberof sync
* @mixin sync-system
* @prop {string} author - A unique identifier for you or your organization.
* @prop {string} app - The name of the app.
* @prop {string} refUrl - Override the base reference. Set this to use your own Firebase.
* @prop {string} instance - Override the instance ID. Can also be overridden with
* a URL parameter.
*/
AFRAME.registerElement('altspace-sync', {
	prototype: Object.create(AFRAME.ANode.prototype, { createdCallback: { value: function() {
		if (!/altspace-sync-instance/.test(location.search)) {
			// The sync utility is going to reload the page anyway, so don't bother loading any assets
			THREE.XHRLoader.prototype.load = function () { };
			THREE.Loader.Handlers.add(/jpe?g|png/i, {load: function () { }});
		}
		var component = this;
		this.sceneEl = document.querySelector('a-scene');

		if(!this.hasAttribute('app')){
			console.warn('The sync-system must be present on the scene and configured with required data.');
			return;
		}

		component.connected = false;
		altspace.utilities.sync.connect({
			authorId: this.getAttribute('author'),
			appId: this.getAttribute('app'),
			instanceId: this.getAttribute('instance'),
			baseRefUrl: this.getAttribute('refUrl')
		}).then(function(connection) {
			this.connection = connection;

			this.sceneRef = this.connection.instance.child('scene');
			this.clientsRef = this.connection.instance.child('clients');

			// temporary way of having unique identifiers for each client
			this.clientId = this.sceneEl.object3D.uuid;
			var masterClientId;
			this.clientsRef.on("value", function (snapshot) {
				var clientIds = snapshot.val();

				var masterClientKey = Object.keys(clientIds)[0];
				masterClientId = clientIds[masterClientKey];
			});

			this.clientsRef.on('child_added', function(childSnapshot) {
				var joinedClientId = childSnapshot.val();
				//let the master client flag get set first
				setTimeout(function(){
					component.sceneEl.emit('clientjoined', {id: joinedClientId}, false);
				}, 0);
			});

			this.clientsRef.on('child_removed', function(childSnapshot) {
				var leftClientId = childSnapshot.val();
				//let the master client flag get set first
				setTimeout(function(){
					component.sceneEl.emit('clientleft', {id: leftClientId}, false);
				}, 0);
			});

			// add our client ID to the list of connected clients,
			// but have it be automatically removed by firebase if we disconnect for any reason
			this.clientsRef.push(this.clientId).onDisconnect().remove();


			this.connection.instance.child('initialized').once('value', function (snapshot) {
				var shouldInitialize = !snapshot.val();
				snapshot.ref().set(true);

				component.sceneEl.emit('connected', { shouldInitialize: shouldInitialize }, false);
				component.connected = true;
				// Indicate that this a-node has finished loading
				this.load();
			}.bind(this));


			Object.defineProperty(this, 'isMasterClient', {
				get: function () { return masterClientId === this.clientId; }.bind(this)
			});
		}.bind(this)).catch(function (err) {
			throw err;
		});
	}}})
});
