import { clientsClaim, skipWaiting } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { registerRoute } from 'workbox-routing';
import { CacheOnly } from 'workbox-strategies';

import { cacheName, channelName, urlPrefix } from './constants';

const broadcastChannel = 'BroadcastChannel' in self ? new BroadcastChannel(channelName) : null;

// This event is fired when a user has taken action in the browser to remove
// an item that was previously added to the content index.
// In Android Chrome, this is triggered by a deletion from the Downloads screen.
self.addEventListener('contentdelete', (event) => {
  const cacheKey = event.id;

  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.delete(cacheKey);
  })());
});

const shareTargetHandler = async ({event}) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage('Saving media locally...');
  }

  const formData = await event.request.formData();
  const mediaFiles = formData.getAll('media');
  const cache = await caches.open(cacheName);

  for (const mediaFile of mediaFiles) {
    // TODO: Instead of bailing, come up with a
    // default name for each possible MIME type.
    if (!mediaFile.name) {
      if (broadcastChannel) {
        broadcastChannel.postMessage('Sorry! No name found on incoming media.');
      }
      continue;
    }

    const cacheKey = new URL(`${urlPrefix}${Date.now()}-${mediaFile.name}`, self.location).href;
    await cache.put(
      cacheKey,
      new Response(mediaFile, {
        headers: {
          'content-length': mediaFile.size,
          'content-type': mediaFile.type,
        },
      })
    );
  }
  
  // After the POST succeeds, redirect to the main page.
  return Response.redirect('/', 303);
};

const cachedMediaHandler = new CacheOnly({
  cacheName,
  plugins: [
    // Support for cache requests that include a Range: header.
    new RangeRequestsPlugin(),
  ],
});

skipWaiting();
clientsClaim();

// This will be replaced by the list of files to precache by
// the `workbox injectManifest` build step.
precacheAndRoute(self.__WB_MANIFEST);

// registerRoute(
//   '/_share-target',
//   shareTargetHandler,
//   'POST'
// );

registerRoute(
  new RegExp(urlPrefix),
  cachedMediaHandler
);
