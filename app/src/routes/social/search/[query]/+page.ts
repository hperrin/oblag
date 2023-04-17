import { error } from '@sveltejs/kit';
// import type { Nymph, EntityConstructor } from '@nymphjs/client';
// import { queryParser } from '@nymphjs/query-parser';
import type {
  SocialActor as SocialActorClass,
  SocialActorData,
} from '$lib/entities/SocialActor.js';
import type {
  SocialObject as SocialObjectClass,
  SocialObjectData,
} from '$lib/entities/SocialObject.js';
import { isSocialActivity } from '$lib/utils/checkTypes.js';
import { getActorId } from '$lib/utils/getActorId.js';
import { getObjectId } from '$lib/utils/getObjectId.js';
import { getTargetId } from '$lib/utils/getTargetId.js';
import type { PageLoad } from './$types';

// function parseTodoSearch<T extends EntityConstructor>(
//   query: string,
//   nymph: Nymph
// ) {
//   const Todo = nymph.getEntityClass('Todo') as T;
//   const Project = nymph.getEntityClass('Project') as T;

//   // Filter done by default.
//   if (!query.match(/(?:^| )\[!?done\](?:$| )/)) {
//     query += ' [!done]';
//   }

//   // Limit to 25 todos by default.
//   if (!query.match(/(?:^| )limit:\d+(?:$| )/)) {
//     query += ' limit:25';
//   }

//   // Reverse by default.
//   if (!query.match(/(?:^| )reverse:(?:true|false|1|0)(?:$| )/)) {
//     query += ' reverse:true';
//   }

//   return queryParser({
//     query,
//     entityClass: Todo,
//     defaultFields: ['text'],
//     qrefMap: {
//       Todo: {
//         class: Todo,
//         defaultFields: ['text'],
//       },
//       Project: {
//         class: Project,
//         defaultFields: ['name'],
//       },
//     },
//   });
// }

export const load: PageLoad = async ({ params, parent }) => {
  const { nymph, pubsub, stores, SocialActor, SocialObject } = await parent();
  const { search } = stores;

  try {
    let searchQuery = params.query.trim();
    search.set(searchQuery);

    if (searchQuery.match(/^https?:\/\/\S+$/)) {
      let result = await SocialObject.getId(searchQuery);

      if (result == null) {
        result = await nymph.getEntity(
          { class: SocialActor },
          { type: '&', equal: ['url', searchQuery] }
        );
      }

      if (result && isSocialActivity(result)) {
        let actorId = getActorId(result);
        let objectId = getObjectId(result);
        let targetId = getTargetId(result);

        let actor =
          actorId == null
            ? null
            : ((await SocialObject.getId(actorId)) as SocialActorClass &
                SocialActorData);
        let object =
          objectId == null
            ? null
            : ((await SocialObject.getId(objectId)) as
                | (SocialObjectClass & SocialObjectData)
                | (SocialActorClass & SocialActorData));
        let target =
          targetId == null
            ? null
            : ((await SocialObject.getId(targetId)) as
                | (SocialObjectClass & SocialObjectData)
                | (SocialActorClass & SocialActorData));

        return {
          searchResults: [{ result, actor, object, target }],
        };
      }

      return {
        searchResults:
          result == null
            ? []
            : [{ result, actor: null, object: null, target: null }],
      };
    } else if (
      searchQuery.match(/^@\S+@\S+$/) ||
      searchQuery.match(/^\S+@\S+$/)
    ) {
      const alias = searchQuery.replace(/^@/, '');
      const id = await SocialActor.fingerUser(alias);
      const result = id ? await SocialObject.getId(id) : null;

      return {
        searchResults:
          result == null
            ? []
            : [{ result, actor: null, object: null, target: null }],
      };
    } else {
      return { searchResults: [] };
    }

    // const query = parseTodoSearch<typeof TodoClass>(searchQuery, nymph);
    // const subscribable = pubsub.subscribeEntities(...query);

    // return { subscribable, searchResults: await nymph.getEntities(...query) };
  } catch (e: any) {
    throw error(e?.status ?? 500, e.message);
  }
};
