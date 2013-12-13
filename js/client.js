// torrent client !

function Client(opts) {
    jstorrent.Item.apply(this, arguments)
    /* 
       initializing the client does several async things
       - fetch several local storage items)
       - calls retainEntry for each disk

       want a callback for when all that is done
    */

    this.ready = false
    this.app = opts.app
    this.id = opts.id

    this.torrents = new jstorrent.Collection({__name__: 'Torrents', parent:this, client:this, itemClass: jstorrent.Torrent})
    this.torrents.on('add', _.bind(this.onTorrentAdd, this))

    this.disks = new jstorrent.Collection({__name__: 'Disks', parent:this, client:this, itemClass: jstorrent.Disk})
    console.log('fetching disks')
    this.disks.fetch(_.bind(function() {
        this.torrents.fetch(_.bind(function() {
            this.ready = true
            this.trigger('ready')
        },this))
    },this))

    this.workerthread = new jstorrent.WorkerThread({client:this});

    // able to retreive piece data from a cache
    //this.diskcache = new jstorrent.DiskCache({client:this}) // better to call it a piece cache, perhaps...

    this.peeridbytes = []
    for (var i=0; i<20; i++) {
        this.peeridbytes.push( 
            Math.floor( Math.random() * 256 )
        )
    }
    //this.interval = setInterval( _.bind(this.frame,this), 1000 ) // try to only to edge triggered so that background page can go to slep

    this.on('error', _.bind(this.onError, this))
    this.on('ready', _.bind(this.onReady, this))
}

Client.prototype = {
    onTorrentAdd: function(torrent) {
        if (this.app.options.get('new_torrents_auto_start')) {
            torrent.start()
        }
        torrent.save()
    },
    onReady: function() {
        var item
        if (window.jstorrent_launchData) {
            while (true) {
                item = window.jstorrent_launchData.pop()
                if (! item) { break }
                this.handleLaunchData(item)
            }
        }
    },
    handleLaunchData: function(launchData) {
        var item
        // check if client is ready for this, even...
        console.log('handle launch data',launchData)
        if (launchData.type == 'onMessageExternal') {
            var request = launchData.request
            this.add_from_url(request.url)
        } else if (launchData.type == 'onLaunched') {
            if (launchData.launchData.items && launchData.launchData.items.length > 0) {
                for (var i=0; i<launchData.launchData.items.length; i++) {
                    item = launchData.launchData.items[i]
                    console.log('APP HANDLE LAUNCH ENTRY',item)
                    this.handleLaunchWithItem(item)
                }
            }
        } else {
            debugger
        }
    },
    handleLaunchWithItem: function(item) {
        if (item.type == "application/x-bittorrent") {
            console.log('have a bittorrent file... hrm whattodo',item.entry)

            var entry = item.entry
            
            var torrent = new jstorrent.Torrent({client:this,
                                                 entry:item.entry,
                                                 callback: _.bind(function(result) {
                                                     if (result.torrent) {
                                                         this.torrents.add(result.torrent)
                                                     } else {
                                                         console.error('error initializing torrent from entry', result)
                                                     }
                                                 },this)
                                                })
            

        }
    },
    onError: function(e) {
        console.error('client error',e)
    },
    stop: function() {
        clearInterval( this.interval )
    },
    set_ui: function(ui) {
        this.ui = ui
    },
    add_from_url: function(url) {
        // adds a torrent from a text input url

        // parse url
        console.log('client add by url',url)

        // valid url?
        var torrent = new jstorrent.Torrent({url:url, client:this})

        if (torrent.invalid) {
            app.notify('torrent url invalid');
        } else if (this.torrents.contains(torrent)) {
            console.warn('already have this torrent!')
            // we already had this torrent, maybe add the trackers to it...
        } else {
            this.torrents.add( torrent )
            this.torrents.save()
        }
    },
    frame: function() {
        // TODO -- only do a frame when there is at least one started torrent
        this.torrents.each( function(torrent) {
            torrent.frame()
        })
    }
}

jstorrent.Client = Client

for (var method in jstorrent.Item.prototype) {
    jstorrent.Client.prototype[method] = jstorrent.Item.prototype[method]
}
