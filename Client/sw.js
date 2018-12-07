if (typeof idb === 'undefined') {
  self.importScripts('js/idb.js');
}
if (typeof DBHelper === 'undefined') {
  self.importScripts('/js/dbhelper.min.js');
}
// Version of cache
let CACHE_VERSION = 1;
const CURRENT_CACHES = {
  prefetch: 'prefetch-cache-v' + CACHE_VERSION
};
let dbReady = false;

const cacheOptions = {
  ignoreSearch: true
};

const loadCacheOrNetwork = (request, CacheRequestUrl, isSameOrigin) =>
  caches.match(request, cacheOptions)
    .then(response => response || fetch(request)
    .then(networkResponse => {
      if (
        networkResponse.status === 404
        && isSameOrigin
        && CacheRequestUrl.pathname.startsWith('/img')
        && CacheRequestUrl.pathname.endsWith('.jpg')
      ) {
        return caches.match('img/na.png')
          .then(noimageResponse => noimageResponse);
      } else {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_VERSION).then(cache => {
          cache.put(request, responseClone);
        });
        return networkResponse;
      }
    }
    ));

// open indexedDB and upgrade 
const dbPromise = idb.open('restaurant-reviews', 2, upgradeDB => {
    switch (upgradeDB.oldVersion) {
      case 0:
      // a placeholder case so that the switch block will
      // execute when the database is first created
      // (oldVersion is 0)
      case 1:
      {
        console.log('Making a new Restaurants object store');
        const restaurantsObjectStore = upgradeDB.createObjectStore('restaurants', { keyPath: 'id'});
      }
      case 2:
      {   
        console.log("Making a new Reviews object store");  
        const reviewsObjectStore = upgradeDB.createObjectStore('reviews', { keyPath: 'id' });
          reviewsObjectStore.createIndex('restaurant_id', 'restaurant_id');
      }
      case 3:
      {
        console.log('Making a new Pending store');
        upgradeDB.createObjectStore('pending', {
          keyPath: 'id',
          autoIncrement: true
        });
     }
    }
});

// self.importScripts('/js/dbhelper.min.js');

// Installing the Service Worker
self.addEventListener('install', event => {
  let now = Date.now();

  // Files to be cache
  const URLSTOCACHE = [
    '/',
    '/index.html',
    '/restaurant.html',
    '/css/styles.min.css',
    '/img/',
    '/img/na.png',
    '/js/dbhelper.min.js',
    '/js/idb.min.js',
    '/js/main.js',
    '/js/restaurant_info.js',
    '/manifest.json',
    '/sw.js'
    ];
  console.log('Handling install event. Resources to fetch:', URLSTOCACHE);
   
  event.waitUntil(
    caches.open(CURRENT_CACHES.prefetch).then(cache => {
      return cache.addAll(URLSTOCACHE).then(() => {
        console.log('All resources have been fetched and cached.');
      }).catch(error => {
      console.error('Pre-fetching failed:', error);
      let cachePromises = URLSTOCACHE.map(URLSTOCACHE => {
        return Promise.all(cachePromises).then(() => {
          console.log('Pre-fetching complete.');
        });
      });
    });
  }));
});

// Activating the Service Worker
/* self.addEventListener('activate', event => { 
  // clients.claim() tells the active service worker to take immediate
  // control of all of the clients under its scope.
  self.clients.claim();
  // Delete all caches that aren't named in CACHE_VERSION.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
      cacheNames.filter(cacheName => {
        console.log('Service worker activated');
        return cacheName !== CACHE_VERSION;
        // If this cache name isn't present in the array of 'expected' cache names,
        // then delete it.
      }).map(cacheName => {
        console.log('Deleting out of date cache:', cacheName);
        return caches.delete(cacheName);
      }));
    }));
}); */


// Fetching cache from the Service Worker
self.addEventListener('fetch', event => {
  console.log('Handling fetch event for', event.request.url);
  // Perform fetch steps
  let cacheRequest = event.request;
  const CacheRequestUrl = new URL(event.request.url);

  // Do not use service worker for the Leaflet Map API or restaurants API
  if (event.request.url.indexOf('unpkg.com/leaflet') !== -1 ||
    event.request.url.indexOf('/restaurants/') !== -1) {
    return;
  }

  if (event.request.url.indexOf("restaurant.html") > -1) {
    const cacheURL = "restaurant.html";
    cacheRequest = new Request(cacheURL);
  }

  if (CacheRequestUrl.origin === location.origin) {
    // Redirect 'http://localhost:8000' to 'http://localhost:8000/index.html' since 
    // they should basically be the same html
    if (CacheRequestUrl.pathname === '/') {
      event.respondWith(caches.match('index.html'));
      return;
    }
  }

  if (event.request.url.startsWith('http://localhost:1337')) {
    // avoid caching the API calls as those will be handle by IDB
    return;
  }

  event.respondWith(loadCacheOrNetwork(event.request, CacheRequestUrl, CacheRequestUrl.origin === location.origin));

  const handleAJAXEvent = (event, id) => {
    // Only use caching for GET events
    if (event.request.method !== 'GET') {
      return fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(json => {
        return json
      });
    }

    // Requests going to the API get handled separately from those
    // going to other destinations
    /* if (CacheRequestUrl.port === '1337') {
      const parts = CacheRequestUrl.pathname.split('/');
      const id = parts[parts.length - 1] === 'restaurants' ? '-1' : parts[parts.length - 1];
      handleAJAXEvent(event, id);
    } else {
      handleNonAJAXEvent(event, cacheRequest);
    } */

    // Split these requests for handling restaurants vs reviews
    if (event.request.url.indexOf('reviews') > -1) {
      handleReviewsEvent(event, id);
    } else {
     handleRestaurantEvent(event, id);
    }
  }

  const handleReviewsEvent = (event, id) => {
    event.respondWith(
      dbPromise.then(db => {
      return db.transaction('reviews').objectStore('reviews')
        .index('restaurant_id').getAll(id);
      }).then(data => {
      return (data.length && data) || fetch(event.request)
        .then(fetchResponse => fetchResponse.json())
        .then(data => {
          return dbPromise.then(idb => {
            const itx = idb.transaction('reviews', 'readwrite');
            const store = itx.objectStore('reviews');
            data.forEach(review => {
              store.put({ id: review.id, 'restaurant_id': review['restaurant_id'], data: review });
            })
            return data;
          })
        })
    }).then(finalResponse => {
      if (finalResponse[0].data) {
        // Need to transform the data to the proper format
        const mapResponse = finalResponse.map(review => review.data);
        return new Response(JSON.stringify(mapResponse));
      }
      return new Response(JSON.stringify(finalResponse));
    }).catch(error => {
      return new Response('Error fetching data', { status: 500 })
    }))
  }

  const handleRestaurantEvent = (event, id) => {
    // Check the IndexedDB to see if the JSON for the API has already been stored
    // there. If so, return that. If not, request it from the API, store it, and
    // then return it back.
    event.respondWith(
      dbPromise.then(db => {
      return db
      .transaction('restaurants')
      .objectStore('restaurants')
      .getAll(id);
    }).then(data => {
      return (data && data.data) || fetch(event.request)
        .then(fetchResponse => fetchResponse.json())
        .then(json => {
          return dbPromise.then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            const store = tx.objectStore('restaurants');
            store.put({ id: id, data: json });
           return json;
          });
        });
    }).then(finalResponse => {
      return new Response(JSON.stringify(finalResponse));
    }).catch(error => {
      return new Response('Error fetching data', { status: 500 });
    }));
  };

  const handleNonAJAXEvent = (event, cacheRequest) => {
    event.respondWith(
      caches.match(event.request).then(response => {  
        // Cache hit - return response
        if (response) {
          console.log('ServiceWorker returning cache response:', response);
          return response;
        }

        // Clone the request
        let fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Clone the response
          let responseToCache = response.clone();
          caches.open(CACHE_VERSION)
            .then(cache => {
              // Respond with a 200 when offline
              if (response.status < 400) {
              cache.put(event.request, responseToCache);
              } else {
                console.log('  Not caching the response to', event.request.url);
              }
              return response;
            });

            // Cache found - return response
        return response || fetch(event.request).then(response => {
         return response;
      });
      });
    }));
    // Check if the HTML request has previously been cached. If so, return the
    // response from the cache. If not, fetch the request, cache it, and then return
    // it.
    event.respondWith(
      caches.match(cacheRequest).then(response => {
        return (response || fetch(event.request).then(fetchResponse => {
          return caches
            .open(CACHE_VERSION).then(cache => {
              if (fetchResponse.url.indexOf('restaurant.html') === -1) {
                cache.put(event.request, fetchResponse.clone());
              }
              return fetchResponse;
            });
        }).catch(error => {
          if (event.request.url.indexOf('.jpg') > -1) {
            return caches.match('/img/na.png');
          }
          return new Response('Application is not connected to the internet', {
            status: 404,
            statusText: 'Application is not connected to the internet'
          });
        }));
      }));
  };
});

// skipWaiting() allows this service worker to 
// become active immediately
self.addEventListener('message', event => {
  if (event.data && event.data.updated) {
    self.skipWaiting();
  }
});