import type { Nymph, Options, Selector } from '@nymphjs/nymph';
import { guid } from '@nymphjs/guid';
import { User as UserClass } from '@nymphjs/tilmeld';
import type {
  IApexStore,
  Context,
  APEXObject,
  APEXActivity,
  APEXActor,
  APEXIntransitiveActivity,
  Delivery,
} from 'activitypub-express';
import ActivitypubExpress from 'activitypub-express';

import { SocialContext as SocialContextClass } from './entities/SocialContext.js';
import type { SocialContextData } from './entities/SocialContext.js';
import { SocialDelivery as SocialDeliveryClass } from './entities/SocialDelivery.js';
import type { SocialDeliveryData } from './entities/SocialDelivery.js';
import { SocialActivity as SocialActivityClass } from './entities/SocialActivity.js';
import type { SocialActivityData } from './entities/SocialActivity.js';
import { SocialActor as SocialActorClass } from './entities/SocialActor.js';
import type { SocialActorData } from './entities/SocialActor.js';
import { SocialCollection as SocialCollectionClass } from './entities/SocialCollection.js';
import type { SocialCollectionData } from './entities/SocialCollection.js';
import { SocialCollectionEntry as SocialCollectionEntryClass } from './entities/SocialCollectionEntry.js';
import type { SocialCollectionEntryData } from './entities/SocialCollectionEntry.js';
import { SocialObject as SocialObjectClass } from './entities/SocialObject.js';
import type { SocialObjectData } from './entities/SocialObject.js';

import {
  AP_ROUTES,
  AP_USER_ID_PREFIX,
  AP_USER_INBOX_PREFIX,
  AP_USER_OUTBOX_PREFIX,
  AP_USER_FOLLOWERS_PREFIX,
  AP_USER_FOLLOWING_PREFIX,
  AP_USER_LIKED_PREFIX,
} from './utils/constants.js';
import { isActivity, isActor, isObject } from './utils/checkTypes.js';

export function buildApex(nymph: Nymph) {
  const store = new ApexStore(nymph);

  return ActivitypubExpress({
    name: 'Neso',
    version: process.env.npm_package_version,
    openRegistrations: false,
    nodeInfoMetadata: {},
    baseUrl: 'http://127.0.0.1:5173',
    domain: '127.0.0.1',
    actorParam: 'actor',
    objectParam: 'id',
    activityParam: 'id',
    routes: AP_ROUTES,
    store,
    endpoints: {
      uploadMedia: 'https://localhost/upload',
      oauthAuthorizationEndpoint: 'https://localhost/oauth/authorize',
      proxyUrl: 'https://localhost/proxy',
    },
  });
}

class ApexStore implements IApexStore {
  nymph: Nymph;
  User: typeof UserClass;
  SocialContext: typeof SocialContextClass;
  SocialDelivery: typeof SocialDeliveryClass;
  SocialActivity: typeof SocialActivityClass;
  SocialActor: typeof SocialActorClass;
  SocialCollection: typeof SocialCollectionClass;
  SocialCollectionEntry: typeof SocialCollectionEntryClass;
  SocialObject: typeof SocialObjectClass;

  constructor(nymph: Nymph) {
    this.nymph = nymph;
    this.User = nymph.getEntityClass(UserClass.class) as typeof UserClass;
    this.SocialContext = nymph.getEntityClass(
      SocialContextClass.class
    ) as typeof SocialContextClass;
    this.SocialDelivery = nymph.getEntityClass(
      SocialDeliveryClass.class
    ) as typeof SocialDeliveryClass;
    this.SocialActivity = nymph.getEntityClass(
      SocialActivityClass.class
    ) as typeof SocialActivityClass;
    this.SocialActor = nymph.getEntityClass(
      SocialActorClass.class
    ) as typeof SocialActorClass;
    this.SocialCollection = nymph.getEntityClass(
      SocialCollectionClass.class
    ) as typeof SocialCollectionClass;
    this.SocialCollectionEntry = nymph.getEntityClass(
      SocialCollectionEntryClass.class
    ) as typeof SocialCollectionEntryClass;
    this.SocialObject = nymph.getEntityClass(
      SocialObjectClass.class
    ) as typeof SocialObjectClass;
  }

  async setup(_optionalActor: APEXActor) {
    // TODO
    console.log('setup');
  }

  async getObject(id: string, includeMeta: boolean) {
    // console.log('getObject', { id, includeMeta });

    // Look for an actor.
    const actor = await this.SocialActor.factoryId(id);
    if (actor.guid != null) {
      return (await actor.$toAPObject(includeMeta)) as APEXActor;
    } else if (id.startsWith(AP_USER_ID_PREFIX)) {
      // This is a user who doesn't have an actor object yet. Let's make them
      // one.
      const username = id.substring(AP_USER_ID_PREFIX.length);
      const user = await this.User.factoryUsername(username);

      if (!user) {
        throw new Error('Not found.');
      }

      actor.$acceptAPObject(
        {
          type: 'Person',
          id: `${AP_USER_ID_PREFIX}${user.username}`,
          name: user.name,
          preferredUsername: user.username,
          inbox: `${AP_USER_INBOX_PREFIX}${user.username}`,
          outbox: `${AP_USER_OUTBOX_PREFIX}${user.username}`,
          followers: `${AP_USER_FOLLOWERS_PREFIX}${user.username}`,
          following: `${AP_USER_FOLLOWING_PREFIX}${user.username}`,
          liked: `${AP_USER_LIKED_PREFIX}${user.username}`,
        } as APEXActor,
        true
      );

      actor.user = user;

      if (!(await actor.$saveSkipAC())) {
        throw new Error("Couldn't create actor for user.");
      }

      return (await actor.$toAPObject(includeMeta)) as APEXActor;
    }

    // Look for an object.
    const object = await this.SocialObject.factoryId(id);
    if (object.guid != null) {
      return (await object.$toAPObject(includeMeta)) as APEXObject;
    }

    throw new Error('Not found.');
  }

  async saveObject(object: APEXObject) {
    // console.log('saveObject', object);

    if (isActivity(object)) {
      const obj = await this.SocialActivity.factory();
      await obj.$acceptAPObject(object, true);

      return await obj.$saveSkipAC();
    }

    if (isActor(object)) {
      const obj = await this.SocialActor.factory();
      await obj.$acceptAPObject(object, true);

      return await obj.$saveSkipAC();
    }

    if (isObject(object)) {
      const obj = await this.SocialObject.factory();
      await obj.$acceptAPObject(object, true);

      return await obj.$saveSkipAC();
    }

    throw new Error('Unsupported object type.');
  }

  async getActivity(id: string, includeMeta: boolean) {
    // console.log('getActivity', { id, includeMeta });

    // Look for an activity.
    const activity = await this.SocialActivity.factoryId(id);
    if (activity != null) {
      return (await activity.$toAPObject(includeMeta)) as APEXActivity;
    }

    throw new Error('Not found.');
  }

  async findActivityByCollectionAndObjectId(
    collection: string,
    objectId: string,
    includeMeta: boolean
  ) {
    // console.log('findActivityByCollectionAndObjectId', {
    //   collection,
    //   objectId,
    //   includeMeta,
    // });

    const entity = await this.nymph.getEntity(
      { class: this.SocialCollectionEntry },
      {
        type: '&',
        qref: [
          [
            'collection',
            [
              { class: this.SocialCollection },
              { type: '&', equal: ['id', collection] },
            ],
          ],
          [
            'entry',
            [
              { class: this.SocialActivity },
              {
                type: '|',
                equal: ['object', objectId],
                contain: ['object', objectId],
                qref: [
                  'object',
                  [
                    { class: this.SocialObject },
                    { type: '&', equal: ['id', objectId] },
                  ],
                ],
              },
            ],
          ],
        ],
      }
    );
    if (entity) {
      return (await entity.entry.$toAPObject(includeMeta)) as APEXActivity;
    }
    return null;
  }

  async findActivityByCollectionAndActorId(
    collection: string,
    actorId: string,
    includeMeta: boolean
  ) {
    // console.log('findActivityByCollectionAndActorId', {
    //   collection,
    //   actorId,
    //   includeMeta,
    // });

    const entity = await this.nymph.getEntity(
      { class: this.SocialCollectionEntry },
      {
        type: '&',
        qref: [
          [
            'collection',
            [
              { class: this.SocialCollection },
              { type: '&', equal: ['id', collection] },
            ],
          ],
          [
            'entry',
            [
              { class: this.SocialActivity },
              {
                type: '|',
                equal: ['actor', actorId],
                contain: ['actor', actorId],
                qref: [
                  'actor',
                  [
                    { class: this.SocialActor },
                    { type: '&', equal: ['id', actorId] },
                  ],
                ],
              },
            ],
          ],
        ],
      }
    );
    if (entity) {
      return (await entity.entry.$toAPObject(includeMeta)) as APEXActivity;
    }
    return null;
  }

  /**
   * Return a specific collection (stream of activitites), e.g. a user's inbox
   * @param collectionId collection identifier
   * @param limit max number of activities to return
   * @param after id to begin querying after (i.e. last item of last page)
   * @param blockList list of ids of actors whose activities should be excluded
   * @param query additional query/aggregation
   */
  async getStream(
    collectionId: string,
    limit?: number | null,
    after?: string | null,
    blockList?: string[],
    query?: any
  ) {
    // console.log('getStream', {
    //   collectionId,
    //   limit,
    //   after,
    //   blockList,
    //   query,
    // });

    let afterEntry:
      | (SocialCollectionEntryClass & SocialCollectionEntryData)
      | null = null;
    if (after) {
      let afterEntity: SocialActivityClass & SocialActivityData;
      afterEntity = await this.SocialActivity.factoryId(after);

      if (afterEntity.guid != null) {
        afterEntry = await this.nymph.getEntity(
          { class: this.SocialCollectionEntry },
          { type: '&', ref: ['entry', afterEntity] }
        );
      }
    }

    const entries = await this.nymph.getEntities(
      {
        class: this.SocialCollectionEntry,
        sort: 'cdate',
        reverse: true,
        ...(limit != null ? { limit } : {}),
      },
      {
        type: '&',
        qref: [
          [
            'collection',
            [
              { class: this.SocialCollection },
              { type: '&', equal: ['id', collectionId] },
            ],
          ],
        ],
        ...(afterEntry != null && afterEntry.guid != null
          ? {
              lte: ['cdate', afterEntry.cdate || 0],
              '!guid': afterEntry.guid,
            }
          : {}),
      },
      ...(blockList?.length
        ? [
            {
              type: '!&',
              qref: [
                [
                  'entry',
                  [
                    { class: this.SocialActivity },
                    {
                      type: '|',
                      equal: blockList.map(
                        (actor) => ['actor', actor] as [string, string]
                      ),
                      contain: blockList.map(
                        (actor) => ['actor', actor] as [string, string]
                      ),
                      qref: blockList.map(
                        (actor) =>
                          [
                            'actor',
                            [
                              { class: this.SocialActor },
                              {
                                type: '&',
                                equal: ['id', actor],
                              },
                            ],
                          ] as [string, [Options, ...Selector[]]]
                      ),
                    },
                  ],
                ],
              ],
            } as Selector,
          ]
        : [])
    );

    return (await Promise.all(
      entries.map((e) => e.entry.$toAPObject(false))
    )) as APEXActivity[];
  }

  async getStreamCount(collectionId: string) {
    // console.log('getStreamCount', { collectionId });
    return await this.nymph.getEntities(
      { class: this.SocialCollectionEntry, return: 'count' },
      {
        type: '&',
        qref: [
          [
            'collection',
            [
              { class: this.SocialCollection },
              { type: '&', equal: ['id', collectionId] },
            ],
          ],
        ],
      }
    );
  }

  async getContext(documentUrl: string) {
    // console.log('getContext', { documentUrl });

    return this.nymph.getEntity(
      { class: this.SocialContext, skipAc: true },
      { type: '&', equal: ['documentUrl', documentUrl] }
    );
  }

  async getUsercount() {
    // console.log('getUsercount');

    return await this.nymph.getEntities(
      { class: this.User, return: 'count', skipAc: true },
      { type: '&', truthy: 'enabled' }
    );
  }

  async saveContext(context: Context) {
    // console.log('saveContext', context);

    const contextEntity = await this.SocialContext.factory();

    contextEntity.contextUrl = context.contextUrl;
    contextEntity.documentUrl = context.documentUrl;
    contextEntity.document = context.document;

    if (!(await contextEntity.$saveSkipAC())) {
      throw new Error("Couldn't save context.");
    }
  }

  /**
   * Return true if it was saved and is new. Return false if saving failed.
   * Return undefined if it has already been saved (the ID exists).
   */
  async saveActivity(activity: APEXActivity | APEXIntransitiveActivity) {
    // TODO
    console.log('saveActivity', activity);
    return true;
  }

  async removeActivity(
    activity: APEXActivity | APEXIntransitiveActivity,
    actorId: string
  ) {
    // TODO
    console.log('removeActivity', activity, { actorId });
    return [];
  }

  /**
   * Return the activity after updating it.
   */
  async updateActivity(
    activity: APEXActivity | APEXIntransitiveActivity,
    fullReplace: boolean
  ) {
    // TODO
    console.log('updateActivity', activity, { fullReplace });
    return activity;
  }

  /**
   * Return the activity after updating the meta.
   */
  async updateActivityMeta(
    activity: APEXActivity | APEXIntransitiveActivity,
    key: string,
    value: any,
    remove: boolean
  ) {
    // TODO
    console.log('updateActivityMeta', activity, { key, value, remove });
    return activity;
  }

  generateId() {
    // console.log('generateId');
    return guid();
  }

  async updateObject(obj: APEXObject, actorId: string, fullReplace: boolean) {
    // TODO
    console.log('updateObject', obj, {
      actorId,
      fullReplace,
    });
    return obj;
  }

  /**
   * Find the first deliver where `after` is less than `new Date()`, delete
   * it, and return it.
   *
   * If none exist, find the next delivery, and return a `waitUntil` for its
   * `after`.
   *
   * If no deliveries exist, return null.
   */
  async deliveryDequeue() {
    // console.log('deliveryDequeue');

    const delivery = await this.nymph.getEntity(
      { class: this.SocialDelivery, sort: 'after', skipAc: true },
      { type: '&', lt: ['after', new Date().getTime()] }
    );

    if (delivery != null) {
      const value = {
        address: delivery.address,
        actorId: delivery.actorId,
        signingKey: delivery.signingKey,
        body: delivery.body,
        attempt: delivery.attempt,
        after: new Date(delivery.after),
      };

      await delivery.$deleteSkipAC();

      return value;
    }

    const next = await this.nymph.getEntity({
      class: this.SocialDelivery,
      sort: 'after',
      skipAc: true,
    });

    if (next != null) {
      return { waitUntil: new Date(next.after) };
    }

    return null;
  }

  async deliveryEnqueue(
    actorId: string,
    body: string,
    addresses: string | string[],
    signingKey: string
  ) {
    // console.log('deliveryEnqueue', {
    //   actorId,
    //   body,
    //   addresses,
    //   signingKey,
    // });

    if (!Array.isArray(addresses)) {
      addresses = [addresses];
    }

    for (let address of addresses) {
      const delivery = await this.SocialDelivery.factory();
      delivery.address = address;
      delivery.actorId = actorId;
      delivery.signingKey = signingKey;
      delivery.body = body;
      delivery.attempt = 0;
      delivery.after = new Date().getTime();

      await delivery.$saveSkipAC();
    }

    return true;
  }

  /**
   * Insert the delivery back into the DB after updating its `after` prop.
   */
  async deliveryRequeue(delivery: Delivery) {
    // console.log('deliveryRequeue', delivery);

    const deliveryEntity = await this.SocialDelivery.factory();
    deliveryEntity.address = delivery.address;
    deliveryEntity.actorId = delivery.actorId;
    deliveryEntity.signingKey = delivery.signingKey;
    deliveryEntity.body = delivery.body;
    deliveryEntity.attempt = delivery.attempt + 1;
    deliveryEntity.after =
      delivery.after.getTime() + Math.pow(10, deliveryEntity.attempt);

    if (!(await deliveryEntity.$saveSkipAC())) {
      throw new Error("Couldn't save delivery.");
    }
  }
}
